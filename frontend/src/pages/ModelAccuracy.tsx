import { useEffect, useState } from 'react'
import { apiGet } from '../lib/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastRun {
  id: string
  data_start_period: number
  data_end_period: number
  forecast_start_period: number
  forecast_end_period: number
  status: string
  created_at: string
}

interface Metric {
  id: string
  forecast_run_id: string
  emission_factor: string
  mae: number | null
  rmse: number | null
  mape: number | null
}

interface RunDetail {
  run: ForecastRun
  results: unknown[]
  metrics: Metric[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 3): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dec })
}

function MapeChip({ mape }: { mape: number | null }) {
  if (mape == null) return <span className="text-gray-400 tabular-nums">—</span>
  if (mape < 10)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        {mape.toFixed(1)}% ✓ Good
      </span>
    )
  if (mape < 20)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        {mape.toFixed(1)}% ~ Fair
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      {mape.toFixed(1)}% ✗ High
    </span>
  )
}

const FACTOR_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  transportation: 'Transportation',
  waste: 'Waste',
}

const METRIC_EXPLANATIONS = [
  {
    name: 'MAE',
    full: 'Mean Absolute Error',
    formula: 'mean(|actual − predicted|)',
    desc: 'Average absolute difference between predicted and actual values. Easy to interpret — expressed in the same unit as your data (tCO₂e). Lower is always better.',
    scale: 'Scale: in tCO₂e — depends on data magnitude.',
  },
  {
    name: 'RMSE',
    full: 'Root Mean Squared Error',
    formula: '√ mean((actual − predicted)²)',
    desc: 'Square root of the average squared differences. Penalises large individual errors more heavily than MAE. Useful when big misses are especially costly.',
    scale: 'Scale: in tCO₂e — comparable to MAE but always ≥ MAE.',
  },
  {
    name: 'MAPE',
    full: 'Mean Absolute Percentage Error',
    formula: 'mean(|actual − predicted| / |actual|) × 100',
    desc: 'Expresses error as a percentage of actual values. Scale-independent — useful for comparing across different emission sources regardless of magnitude.',
    scale: 'Under 10% = Good · 10–20% = Fair · Above 20% = High error.',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModelAccuracy() {
  const [runs, setRuns] = useState<ForecastRun[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load all completed runs ────────────────────────────────────────────────
  useEffect(() => {
    apiGet<{ runs: ForecastRun[] }>('/api/forecast/runs')
      .then(({ runs: r }) => {
        const completed = r.filter((x) => x.status === 'completed')
        setRuns(completed)
        if (completed.length > 0) setSelectedId(completed[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load forecast runs'))
      .finally(() => setLoadingRuns(false))
  }, [])

  // ── Load detail for selected run ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return
    setLoadingDetail(true)
    setDetail(null)
    setError(null)
    apiGet<RunDetail>(`/api/forecast/${selectedId}`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load run details'))
      .finally(() => setLoadingDetail(false))
  }, [selectedId])

  const factors = ['electricity', 'transportation', 'waste']

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Model Accuracy</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          ETS forecast evaluation — MAE, RMSE, and MAPE measured on a holdout split of the last
          1–3 historical data points.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingRuns ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
          Loading forecast runs…
        </div>
      ) : runs.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-semibold text-gray-700">No completed forecast runs yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Go to{' '}
            <a href="/forecast" className="text-emerald-600 hover:underline font-medium">
              Forecast
            </a>{' '}
            and generate your first forecast to see accuracy metrics here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Run selector ───────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <label
              htmlFor="run-selector"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select forecast run
            </label>
            <select
              id="run-selector"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  — Data {r.data_start_period}–{r.data_end_period}, Forecast{' '}
                  {r.forecast_start_period}–{r.forecast_end_period}
                </option>
              ))}
            </select>
          </div>

          {/* ── Metrics table ──────────────────────────────────────────────── */}
          {loadingDetail ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
              Loading metrics…
            </div>
          ) : (
            detail && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Evaluation Metrics</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Run {detail.run.data_start_period}–{detail.run.data_end_period} →
                      forecast {detail.run.forecast_start_period}–{detail.run.forecast_end_period}
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    ✓ Completed
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-5 py-3 text-left">Emission Factor</th>
                        <th className="px-5 py-3 text-right">MAE (tCO₂e)</th>
                        <th className="px-5 py-3 text-right">RMSE (tCO₂e)</th>
                        <th className="px-5 py-3 text-right">MAPE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {factors.map((factor) => {
                        const m = detail.metrics.find((x) => x.emission_factor === factor)
                        return (
                          <tr key={factor} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5 font-medium text-gray-800">
                              {FACTOR_LABELS[factor]}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums">{fmt(m?.mae)}</td>
                            <td className="px-5 py-3.5 text-right tabular-nums">{fmt(m?.rmse)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <MapeChip mape={m?.mape ?? null} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  MAPE guide: &lt;10% ✓ Good &nbsp;·&nbsp; 10–20% ~ Fair &nbsp;·&nbsp; &gt;20% ✗ High
                  error
                </div>
              </div>
            )
          )}

          {/* ── Metric explanations ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {METRIC_EXPLANATIONS.map((m) => (
              <div
                key={m.name}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-xl font-bold text-gray-900">{m.name}</p>
                  <p className="text-xs font-medium text-emerald-600">{m.full}</p>
                </div>
                <code className="block text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1 text-gray-500 mb-3 font-mono">
                  {m.formula}
                </code>
                <p className="text-sm text-gray-600 leading-relaxed mb-2">{m.desc}</p>
                <p className="text-xs text-gray-400 italic">{m.scale}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
