import { useState } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { apiPost } from '../lib/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastResult {
  runId: string
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
  historicalYears: number[]
  historical: {
    electricity: number[]
    transportation: number[]
    waste: number[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 2): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dec })
}

const CURRENT_YEAR = new Date().getFullYear()

// ─── Component ────────────────────────────────────────────────────────────────

export default function Forecast() {
  const [dataStart, setDataStart] = useState(String(CURRENT_YEAR - 5))
  const [dataEnd, setDataEnd] = useState(String(CURRENT_YEAR - 1))
  const [forecastStart, setForecastStart] = useState(String(CURRENT_YEAR))
  const [forecastEnd, setForecastEnd] = useState(String(CURRENT_YEAR + 4))

  const [result, setResult] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await apiPost<ForecastResult>('/api/forecast', {
        dataStartPeriod: parseInt(dataStart),
        dataEndPeriod: parseInt(dataEnd),
        forecastStartPeriod: parseInt(forecastStart),
        forecastEndPeriod: parseInt(forecastEnd),
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Forecast failed')
    } finally {
      setLoading(false)
    }
  }

  // Build chart data: historical bars + forecast lines, joined by year
  const chartData: Record<string, number | string>[] = []
  if (result) {
    // Historical points
    result.historicalYears.forEach((year, i) => {
      chartData.push({
        year,
        'Hist. Electricity': result.historical.electricity[i],
        'Hist. Transportation': result.historical.transportation[i],
        'Hist. Waste': result.historical.waste[i],
      })
    })
    // Forecast points
    result.forecast.years.forEach((year, i) => {
      chartData.push({
        year,
        'Fcst. Electricity': result.forecast.electricity[i],
        'Fcst. Transportation': result.forecast.transportation[i],
        'Fcst. Waste': result.forecast.waste[i],
        'Fcst. Total': result.forecast.total[i],
      })
    })
    // Sort by year
    chartData.sort((a, b) => Number(a.year) - Number(b.year))
  }

  const factors = ['electricity', 'transportation', 'waste'] as const
  const factorLabel: Record<string, string> = {
    electricity: 'Electricity',
    transportation: 'Transportation',
    waste: 'Waste',
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Forecast</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate ETS-based emission forecasts using your historical records.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Forecast Parameters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Data start year
            </label>
            <input
              id="data-start"
              type="number"
              min={2000}
              max={2100}
              value={dataStart}
              onChange={(e) => setDataStart(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data end year</label>
            <input
              id="data-end"
              type="number"
              min={2000}
              max={2100}
              value={dataEnd}
              onChange={(e) => setDataEnd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Forecast start year
            </label>
            <input
              id="forecast-start"
              type="number"
              min={2000}
              max={2100}
              value={forecastStart}
              onChange={(e) => setForecastStart(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Forecast end year
            </label>
            <input
              id="forecast-end"
              type="number"
              min={2000}
              max={2100}
              value={forecastEnd}
              onChange={(e) => setForecastEnd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            id="generate-forecast-btn"
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {loading ? 'Generating…' : '📈 Generate Forecast'}
          </button>
          {loading && (
            <p className="text-xs text-gray-400">
              Running ETS models (electricity, transportation, waste)…
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Combined chart */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Historical + Forecast (tCO₂e)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* Historical bars */}
                <Bar dataKey="Hist. Electricity" fill="#10b981" opacity={0.6} />
                <Bar dataKey="Hist. Transportation" fill="#3b82f6" opacity={0.6} />
                <Bar dataKey="Hist. Waste" fill="#f59e0b" opacity={0.6} />
                {/* Forecast lines */}
                <Line
                  type="monotone"
                  dataKey="Fcst. Electricity"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Fcst. Transportation"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Fcst. Waste"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Fcst. Total"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Model Accuracy Metrics</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Evaluated on a holdout split of the last 1–3 historical points.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Factor</th>
                    <th className="px-4 py-3 text-right">MAE</th>
                    <th className="px-4 py-3 text-right">RMSE</th>
                    <th className="px-4 py-3 text-right">MAPE (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {factors.map((f) => (
                    <tr key={f} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{factorLabel[f]}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(result.metrics[f].mae)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(result.metrics[f].rmse)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {result.metrics[f].mape != null
                          ? `${fmt(result.metrics[f].mape, 1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Forecast values table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Forecast Values (tCO₂e)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Year</th>
                    <th className="px-4 py-3 text-right">Electricity</th>
                    <th className="px-4 py-3 text-right">Transportation</th>
                    <th className="px-4 py-3 text-right">Waste</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.forecast.years.map((year, i) => (
                    <tr key={year} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{year}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(result.forecast.electricity[i])}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(result.forecast.transportation[i])}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(result.forecast.waste[i])}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {fmt(result.forecast.total[i])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
