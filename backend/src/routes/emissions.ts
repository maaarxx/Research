import { Router } from 'express'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// POST /api/emissions/upload
// TODO: parse CSV/XLSX (Year | Electricity | Transportation | Waste),
// validate columns + numeric values + years, return a preview for
// confirmation before writing to Supabase (see spec section 6).
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' })
  }
  return res.status(501).json({
    error: 'Not implemented yet',
    message: 'File received but parsing/validation is not built yet.',
    filename: req.file.originalname,
  })
})

// GET /api/emissions
// TODO: return saved emission_records for the authenticated user.
router.get('/', async (_req, res) => {
  res.json({ records: [] })
})

// GET /api/emissions/summary
// TODO: return aggregated totals per source for dashboard cards.
router.get('/summary', async (_req, res) => {
  res.json({
    total: null,
    electricity: null,
    transportation: null,
    waste: null,
  })
})

// GET /api/emissions/trends
// TODO: return year-over-year series for the historical trend chart.
router.get('/trends', async (_req, res) => {
  res.json({ years: [], electricity: [], transportation: [], waste: [], total: [] })
})

export default router
