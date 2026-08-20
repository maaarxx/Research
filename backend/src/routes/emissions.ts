import { Router, Request, Response } from 'express'
import multer from 'multer'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { extractUser } from '../lib/auth'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewRow {
  row: number
  year: number | null
  electricity: number | null
  transportation: number | null
  waste: number | null
  errors: string[]
  valid: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a header string: trim, lowercase, collapse separators. */
function normaliseKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s_\-]+/g, '')
}

/**
 * Parse raw rows (from CSV or XLSX) into typed + validated PreviewRow objects.
 * Each cell value is a string at this point.
 */
function parseRows(raw: Record<string, unknown>[]): PreviewRow[] {
  return raw.map((rawRow, i) => {
    const errors: string[] = []

    // Normalise keys so "Electricity Emissions", "electricity_emissions", etc. all match
    const norm: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawRow)) {
      norm[normaliseKey(k)] = String(v ?? '').trim()
    }

    // Pick values with flexible key matching
    const yearStr = norm['year'] ?? norm['yr'] ?? ''
    const elStr =
      norm['electricity'] ?? norm['electricityemissions'] ?? norm['electricity(tco2e)'] ?? ''
    const transStr =
      norm['transportation'] ??
      norm['transportationemissions'] ??
      norm['transportation(tco2e)'] ??
      ''
    const wasteStr = norm['waste'] ?? norm['wasteemissions'] ?? norm['waste(tco2e)'] ?? ''

    // Parse numerics
    const year = parseInt(yearStr, 10)
    const electricity = parseFloat(elStr)
    const transportation = parseFloat(transStr)
    const waste = parseFloat(wasteStr)

    // Validate year
    if (!yearStr) {
      errors.push('Year is required')
    } else if (isNaN(year)) {
      errors.push('Year must be a whole number')
    } else if (year < 2000 || year > 2100) {
      errors.push('Year must be between 2000 and 2100')
    }

    // Validate electricity
    if (!elStr) {
      errors.push('Electricity value is required')
    } else if (isNaN(electricity)) {
      errors.push('Electricity must be a number')
    } else if (electricity < 0) {
      errors.push('Electricity must be ≥ 0')
    }

    // Validate transportation
    if (!transStr) {
      errors.push('Transportation value is required')
    } else if (isNaN(transportation)) {
      errors.push('Transportation must be a number')
    } else if (transportation < 0) {
      errors.push('Transportation must be ≥ 0')
    }

    // Validate waste
    if (!wasteStr) {
      errors.push('Waste value is required')
    } else if (isNaN(waste)) {
      errors.push('Waste must be a number')
    } else if (waste < 0) {
      errors.push('Waste must be ≥ 0')
    }

    return {
      row: i + 2, // 1-based, row 1 is the header
      year: isNaN(year) ? null : year,
      electricity: isNaN(electricity) ? null : electricity,
      transportation: isNaN(transportation) ? null : transportation,
      waste: isNaN(waste) ? null : waste,
      errors,
      valid: errors.length === 0,
    }
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/emissions/upload
 * Accept a CSV or XLSX file, parse + validate it, and return a preview.
 * Does NOT write to the database — that happens in /confirm.
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    await extractUser(req) // must be authenticated to upload
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' })
  }

  const ext = req.file.originalname.split('.').pop()?.toLowerCase()
  let rawRows: Record<string, unknown>[] = []

  try {
    if (ext === 'csv') {
      rawRows = parseCsv(req.file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, unknown>[]
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
    } else {
      return res.status(400).json({ error: 'Only CSV and XLSX files are supported.' })
    }
  } catch (e) {
    return res
      .status(400)
      .json({ error: `Failed to parse file: ${e instanceof Error ? e.message : String(e)}` })
  }

  if (rawRows.length === 0) {
    return res.status(400).json({ error: 'File is empty or contains no data rows.' })
  }

  const rows = parseRows(rawRows)
  const validCount = rows.filter((r) => r.valid).length
  const invalidCount = rows.length - validCount

  return res.json({ rows, validCount, invalidCount })
})

/**
 * POST /api/emissions/confirm
 * Insert the validated rows (returned from /upload) into emission_records.
 * Existing rows for the same (user_id, year) are upserted (overwritten).
 */
router.post('/confirm', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { rows } = req.body as { rows?: PreviewRow[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided.' })
  }

  const validRows = rows.filter((r) => r.valid)
  if (validRows.length === 0) {
    return res.status(400).json({ error: 'No valid rows to save.' })
  }

  const inserts = validRows.map((r) => ({
    user_id: user.id,
    year: r.year!,
    electricity_emissions: r.electricity!,
    transportation_emissions: r.transportation!,
    waste_emissions: r.waste!,
  }))

  const { data, error } = await supabase
    .from('emission_records')
    .upsert(inserts, { onConflict: 'user_id,year' })
    .select()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.json({ saved: data?.length ?? validRows.length })
})

/**
 * GET /api/emissions/summary
 * Returns cumulative totals per source for the dashboard cards.
 * Must be registered before /:id to avoid route shadowing.
 */
router.get('/summary', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase
    .from('emission_records')
    .select(
      'year, electricity_emissions, transportation_emissions, waste_emissions, total_emissions',
    )
    .eq('user_id', user.id)
    .order('year', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) {
    return res.json({
      total: null,
      electricity: null,
      transportation: null,
      waste: null,
      recordCount: 0,
      yearRange: null,
    })
  }

  const total = data.reduce((s, r) => s + Number(r.total_emissions), 0)
  const electricity = data.reduce((s, r) => s + Number(r.electricity_emissions), 0)
  const transportation = data.reduce((s, r) => s + Number(r.transportation_emissions), 0)
  const waste = data.reduce((s, r) => s + Number(r.waste_emissions), 0)
  const years = data.map((r) => r.year)
  const yearRange =
    years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : String(years[0])

  return res.json({ total, electricity, transportation, waste, recordCount: data.length, yearRange })
})

/**
 * GET /api/emissions/trends
 * Returns year-by-year series for each source — used by dashboard charts.
 */
router.get('/trends', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase
    .from('emission_records')
    .select(
      'year, electricity_emissions, transportation_emissions, waste_emissions, total_emissions',
    )
    .eq('user_id', user.id)
    .order('year', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const records = data ?? []
  return res.json({
    years: records.map((r) => r.year),
    electricity: records.map((r) => Number(r.electricity_emissions)),
    transportation: records.map((r) => Number(r.transportation_emissions)),
    waste: records.map((r) => Number(r.waste_emissions)),
    total: records.map((r) => Number(r.total_emissions)),
  })
})

/**
 * GET /api/emissions
 * Returns all emission records for the authenticated user.
 */
router.get('/', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase
    .from('emission_records')
    .select('*')
    .eq('user_id', user.id)
    .order('year', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ records: data ?? [] })
})

/**
 * DELETE /api/emissions/:id
 * Delete a single record — ownership verified via user_id filter.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { error } = await supabase
    .from('emission_records')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', user.id) // ownership check

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ deleted: true })
})

export default router
