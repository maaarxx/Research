import { Router } from 'express'

const router = Router()
const FORECASTING_SERVICE_URL = process.env.FORECASTING_SERVICE_URL ?? 'http://localhost:8000'

// POST /api/forecast
// TODO: pull historical emission_records for the requested range from
// Supabase, POST them to the Python service's /forecast endpoint,
// persist forecast_runs / forecast_results / forecast_metrics, and
// return the combined result to the frontend.
router.post('/', async (req, res) => {
  const { dataStartPeriod, dataEndPeriod, forecastStartPeriod, forecastEndPeriod } = req.body ?? {}

  if (!dataStartPeriod || !dataEndPeriod || !forecastStartPeriod || !forecastEndPeriod) {
    return res.status(400).json({
      error: 'dataStartPeriod, dataEndPeriod, forecastStartPeriod, and forecastEndPeriod are required.',
    })
  }

  try {
    // Wiring in place, but this will fail until real historical data +
    // a running forecasting-service exist — that's expected at this stage.
    const response = await fetch(`${FORECASTING_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataStartPeriod, dataEndPeriod, forecastStartPeriod, forecastEndPeriod, series: {} }),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(502).json({
      error: 'Forecasting service unavailable',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

// GET /api/forecast/runs
router.get('/runs', async (_req, res) => {
  res.json({ runs: [] })
})

// GET /api/forecast/:id
router.get('/:id', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet', id: req.params.id })
})

export default router
