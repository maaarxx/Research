import { Router, Request, Response } from 'express'
import { getSupabase } from '../lib/supabaseClient.js'
import { extractUser } from '../lib/auth.js'

const router = Router()
const FORECASTING_SERVICE_URL =
  process.env.FORECASTING_SERVICE_URL ?? 'http://localhost:8000'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PyForecastResult {
  forecast: {
    electricity: number[]
    transportation: number[]
    waste: number[]
    total: number[]
    years: number[]
  }
  metrics: {
    electricity: { mae: number | null; rmse: number | null; mape: number | null }
    transportation: { mae: number | null; rmse: number | null; mape: number | null }
    waste: { mae: number | null; rmse: number | null; mape: number | null }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/forecast
 * Full orchestration:
 *  1. Authenticate user
 *  2. Fetch their historical emission_records for the requested data range
 *  3. POST to Python forecasting service with the series data
 *  4. Persist forecast_runs / forecast_results / forecast_metrics
 *  5. Return combined response to the frontend
 */
router.post('/', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getSupabase(req)

  const { dataStartPeriod, dataEndPeriod, forecastStartPeriod, forecastEndPeriod } =
    req.body ?? {}

  if (!dataStartPeriod || !dataEndPeriod || !forecastStartPeriod || !forecastEndPeriod) {
    return res.status(400).json({
      error:
        'dataStartPeriod, dataEndPeriod, forecastStartPeriod, and forecastEndPeriod are required.',
    })
  }

  // 1. Fetch historical records from Supabase
  const { data: records, error: dbError } = await supabase
    .from('emission_records')
    .select('year, electricity_emissions, transportation_emissions, waste_emissions')
    .eq('user_id', user.id)
    .gte('year', dataStartPeriod)
    .lte('year', dataEndPeriod)
    .order('year', { ascending: true })

  if (dbError) {
    return res.status(500).json({ error: dbError.message })
  }

  if (!records || records.length < 3) {
    return res.status(400).json({
      error: `At least 3 data points are required for ETS forecasting (found ${records?.length ?? 0}).`,
    })
  }

  // 2. Build series for the Python service
  const years = records.map((r) => r.year)
  const series = {
    electricity: records.map((r) => Number(r.electricity_emissions)),
    transportation: records.map((r) => Number(r.transportation_emissions)),
    waste: records.map((r) => Number(r.waste_emissions)),
  }
  const horizon = Number(forecastEndPeriod) - Number(forecastStartPeriod) + 1

  // 3. Create a forecast_run record (status = running)
  const { data: runData, error: runError } = await supabase
    .from('forecast_runs')
    .insert({
      user_id: user.id,
      data_start_period: dataStartPeriod,
      data_end_period: dataEndPeriod,
      forecast_start_period: forecastStartPeriod,
      forecast_end_period: forecastEndPeriod,
      status: 'running',
    })
    .select()
    .single()

  if (runError || !runData) {
    return res.status(500).json({ error: runError?.message ?? 'Failed to create forecast run' })
  }

  // 4. Call the Python forecasting service
  try {
    const pyResponse = await fetch(`${FORECASTING_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataStartPeriod,
        dataEndPeriod,
        forecastStartPeriod,
        forecastEndPeriod,
        series,
        years,
        horizon,
      }),
    })

    if (!pyResponse.ok) {
      const errData = await pyResponse.json().catch(() => ({}))
      await supabase.from('forecast_runs').update({ status: 'failed' }).eq('id', runData.id)
      return res.status(502).json({ error: 'Forecasting service returned an error', detail: errData })
    }

    const pyResult = (await pyResponse.json()) as PyForecastResult

    // 5a. Persist forecast_results (one row per forecast period)
    const forecastYears: number[] =
      pyResult.forecast.years ?? Array.from({ length: horizon }, (_, i) => forecastStartPeriod + i)

    const resultRows = forecastYears.map((period, i) => ({
      forecast_run_id: runData.id,
      period,
      electricity_forecast: pyResult.forecast.electricity?.[i] ?? null,
      transportation_forecast: pyResult.forecast.transportation?.[i] ?? null,
      waste_forecast: pyResult.forecast.waste?.[i] ?? null,
      total_forecast: pyResult.forecast.total?.[i] ?? null,
    }))

    const { error: resultsErr } = await supabase.from('forecast_results').insert(resultRows)
    if (resultsErr) {
      // eslint-disable-next-line no-console
      console.error('forecast_results insert error:', resultsErr.message)
    }

    // 5b. Persist forecast_metrics (one row per factor)
    const metricRows = (['electricity', 'transportation', 'waste'] as const).map((factor) => ({
      forecast_run_id: runData.id,
      emission_factor: factor,
      mae: pyResult.metrics[factor]?.mae ?? null,
      rmse: pyResult.metrics[factor]?.rmse ?? null,
      mape: pyResult.metrics[factor]?.mape ?? null,
    }))

    const { error: metricsErr } = await supabase.from('forecast_metrics').insert(metricRows)
    if (metricsErr) {
      // eslint-disable-next-line no-console
      console.error('forecast_metrics insert error:', metricsErr.message)
    }

    // 5c. Mark run as completed
    await supabase.from('forecast_runs').update({ status: 'completed' }).eq('id', runData.id)

    return res.json({
      runId: runData.id,
      forecast: pyResult.forecast,
      metrics: pyResult.metrics,
      historicalYears: years,
      historical: series,
    })
  } catch (err) {
    await supabase.from('forecast_runs').update({ status: 'failed' }).eq('id', runData.id)
    return res.status(502).json({
      error: 'Forecasting service unavailable',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/**
 * GET /api/forecast/runs
 * Returns all forecast runs for the authenticated user, newest first.
 */
router.get('/runs', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getSupabase(req)

  const { data, error } = await supabase
    .from('forecast_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ runs: data ?? [] })
})

/**
 * GET /api/forecast/:id
 * Returns results + metrics for a specific forecast run (ownership checked).
 */
router.get('/:id', async (req: Request, res: Response) => {
  let user: { id: string }
  try {
    user = await extractUser(req)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getSupabase(req)

  const { data: run, error: runError } = await supabase
    .from('forecast_runs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', user.id)
    .single()

  if (runError || !run) {
    return res.status(404).json({ error: 'Forecast run not found' })
  }

  const [{ data: results }, { data: metrics }] = await Promise.all([
    supabase
      .from('forecast_results')
      .select('*')
      .eq('forecast_run_id', run.id)
      .order('period', { ascending: true }),
    supabase.from('forecast_metrics').select('*').eq('forecast_run_id', run.id),
  ])

  return res.json({ run, results: results ?? [], metrics: metrics ?? [] })
})

export default router
