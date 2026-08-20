import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import emissionsRouter from './routes/emissions'
import forecastRouter from './routes/forecast'

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/emissions', emissionsRouter)
app.use('/api/forecast', forecastRouter)

// TODO: GET /api/analytics, GET /api/reports/:id (spec section 16)

// Basic error handler — don't leak stack traces to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}`)
})
