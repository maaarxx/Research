import { useEffect, useRef, useState } from 'react'
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
import { apiGet } from '../lib/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmissionRecord {
  id: string
  year: number
  electricity_emissions: number
  transportation_emissions: number
  waste_emissions: number
  total_emissions: number
}

interface ForecastRun {
  id: string
  data_start_period: number
  data_end_period: number
  forecast_start_period: number
  forecast_end_period: number
  status: string
  created_at: string
}

interface ForecastResult {
  period: number
  electricity_forecast: number | null
  transportation_forecast: number | null
  waste_forecast: number | null
  total_forecast: number | null
}

interface Metric {
  emission_factor: string
  mae: number | null
  rmse: number | null
  mape: number | null
}

interface RunDetail {
  run: ForecastRun
  results: ForecastResult[]
  metrics: Metric[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 2): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dec })
}

function pctChange(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

// Inject print CSS so the sidebar is hidden when the user prints this page.
function usePrintStyle() {
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'report-print-style'
    style.textContent = `
      @media print {
        @page { margin: 1.5cm; size: A4 portrait; }
        aside, .no-print { display: none !important; }
        main { overflow: visible !important; }
        body { background: white !important; }
        .page-break { page-break-before: always; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById('report-print-style')?.remove() }
  }, [])
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  usePrintStyle()

  const reportRef = useRef<HTMLDivElement>(null)

  const [records, setRecords] = useState<EmissionRecord[]>([])
  const [latestRun, setLatestRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [{ records: recs }, { runs }] = await Promise.all([
        apiGet<{ records: EmissionRecord[] }>('/api/emissions'),
        apiGet<{ runs: ForecastRun[] }>('/api/forecast/runs'),
      ])
      setRecords(recs)

      // Get the most recent completed run's details
      const latestCompleted = runs.find((r) => r.status === 'completed')
      if (latestCompleted) {
        const detail = await apiGet<RunDetail>(`/api/forecast/${latestCompleted.id}`)
        setLatestRun(detail)
      }

      setGenerated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Computed values ──────────────────────────────────────────────────────
  const n = records.length
  const totals = {
    electricity: records.reduce((s, r) => s + Number(r.electricity_emissions), 0),
    transportation: records.reduce((s, r) => s + Number(r.transportation_emissions), 0),
    waste: records.reduce((s, r) => s + Number(r.waste_emissions), 0),
    total: records.reduce((s, r) => s + Number(r.total_emissions), 0),
  }
  const avg = n > 0 ? totals.total / n : 0
  const peakRec = records.length > 0
    ? records.reduce((b, r) => Number(r.total_emissions) > Number(b.total_emissions) ? r : b)
    : null
  const netChange = n >= 2
    ? pctChange(Number(records[n - 1].total_emissions), Number(records[0].total_emissions))
    : null

  // Chart data: historical bars + forecast lines
  const historicalChartData = records.map((r) => ({
    year: r.year,
    'Electricity (hist.)': Number(r.electricity_emissions),
    'Transportation (hist.)': Number(r.transportation_emissions),
    'Waste (hist.)': Number(r.waste_emissions),
  }))
  const forecastChartData: { year: number; 'Total (forecast)'?: number }[] =
    latestRun?.results.map((res) => ({
      year: res.period,
      ...(res.total_forecast != null ? { 'Total (forecast)': res.total_forecast } : {}),
    })) ?? []

  // Merge by year for combined chart
  const allYears = new Map<number, Record<string, number>>()
  historicalChartData.forEach((d) => allYears.set(d.year, { ...d }))
  forecastChartData.forEach((d) => {
    const existing = allYears.get(d.year) ?? { year: d.year }
    allYears.set(d.year, { ...existing, ...d })
  })
  const combinedChart = Array.from(allYears.values()).sort((a, b) => a.year - b.year)

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const yearRange = n > 0 ? `${records[0].year}–${records[n - 1].year}` : '—'

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl">
      {/* Top controls — hidden during print */}
      <div className="no-print mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate a print-ready research report combining historical data, forecasts, and
              accuracy metrics.
            </p>
          </div>
          {generated && records.length > 0 && (
            <button
              id="print-report-btn"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              🖨️ Print / Save as PDF
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
            Loading report data…
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-10 text-center shadow-sm">
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm font-semibold text-gray-700">No data to report yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Upload emission records on the{' '}
              <a href="/emissions" className="text-emerald-600 hover:underline">
                Emission Data
              </a>{' '}
              page first.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PRINTABLE REPORT — everything below this line is in the PDF
      ════════════════════════════════════════════════════════════════════ */}
      {generated && records.length > 0 && (
        <div ref={reportRef} className="bg-white">
          {/* ── Cover section ────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-8 mb-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">
                  Research Report
                </p>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                  School Carbon Emission
                  <br />
                  Monitoring &amp; Forecasting Report
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Study Period: <strong>{yearRange}</strong>
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Generated: <strong>{reportDate}</strong>
                </p>
              </div>
              <div className="text-5xl select-none">🌿</div>
            </div>

            {/* Executive summary */}
            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Emissions', value: `${fmt(totals.total)} tCO₂e` },
                { label: 'Average / Year', value: `${fmt(avg)} tCO₂e` },
                { label: 'Peak Year', value: peakRec ? String(peakRec.year) : '—' },
                { label: 'Net Change', value: netChange != null ? `${netChange >= 0 ? '+' : ''}${netChange.toFixed(1)}%` : '—' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {s.label}
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 1: Historical Emission Data ──────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              1. Historical Emission Data
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Annual emission records per source (tCO₂e) — {yearRange}.
            </p>

            {/* Historical + forecast chart */}
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={combinedChart} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Electricity (hist.)" fill="#10b981" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Transportation (hist.)" fill="#3b82f6" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Waste (hist.)" fill="#f59e0b" opacity={0.8} radius={[2, 2, 0, 0]} />
                {latestRun && (
                  <Line
                    type="monotone"
                    dataKey="Total (forecast)"
                    stroke="#6b7280"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Historical table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left border-b border-gray-200">Year</th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">
                      Electricity
                    </th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">
                      Transportation
                    </th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">Waste</th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200 font-bold">
                      Total (tCO₂e)
                    </th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">YoY Change</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const prev = records[i - 1]
                    const chg = prev
                      ? pctChange(Number(r.total_emissions), Number(prev.total_emissions))
                      : null
                    return (
                      <tr key={r.year} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5 font-semibold">{r.year}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(r.electricity_emissions)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(r.transportation_emissions)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(r.waste_emissions)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {fmt(r.total_emissions)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {chg == null ? (
                            <span className="text-gray-400 text-xs">baseline</span>
                          ) : (
                            <span
                              className={`text-xs font-semibold ${chg >= 0 ? 'text-red-600' : 'text-emerald-600'}`}
                            >
                              {chg >= 0 ? '+' : ''}
                              {chg.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-700">
                  <tr>
                    <td className="px-4 py-2.5 text-xs uppercase text-gray-500">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(totals.electricity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(totals.transportation)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totals.waste)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totals.total)}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {netChange != null && (
                        <span
                          className={`font-bold ${netChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`}
                        >
                          {netChange >= 0 ? '+' : ''}
                          {netChange.toFixed(1)}% net
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Section 2: Source Contribution ────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-1">2. Source Contribution</h3>
            <p className="text-xs text-gray-500 mb-4">
              Cumulative share of each emission source across the study period.
            </p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left border-b border-gray-200">Source</th>
                  <th className="px-4 py-2.5 text-right border-b border-gray-200">
                    Cumulative (tCO₂e)
                  </th>
                  <th className="px-4 py-2.5 text-right border-b border-gray-200">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Electricity', value: totals.electricity },
                  { label: 'Transportation', value: totals.transportation },
                  { label: 'Waste', value: totals.waste },
                ].map((s) => (
                  <tr key={s.label} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-medium">{s.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.value)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {totals.total > 0 ? ((s.value / totals.total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-700">
                <tr>
                  <td className="px-4 py-2.5">Grand Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totals.total)}</td>
                  <td className="px-4 py-2.5 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Section 3: Forecast Results ────────────────────────────────── */}
          {latestRun && latestRun.results.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm page-break">
              <h3 className="text-base font-bold text-gray-800 mb-1">3. ETS Forecast Results</h3>
              <p className="text-xs text-gray-500 mb-1">
                Forecast period:{' '}
                <strong>
                  {latestRun.run.forecast_start_period}–{latestRun.run.forecast_end_period}
                </strong>
                . Based on historical data from{' '}
                <strong>
                  {latestRun.run.data_start_period}–{latestRun.run.data_end_period}
                </strong>
                .
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Model: Exponential Smoothing (Holt's additive trend with damping) — fit independently
                per emission factor.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left border-b border-gray-200">Year</th>
                      <th className="px-4 py-2.5 text-right border-b border-gray-200">
                        Electricity
                      </th>
                      <th className="px-4 py-2.5 text-right border-b border-gray-200">
                        Transportation
                      </th>
                      <th className="px-4 py-2.5 text-right border-b border-gray-200">Waste</th>
                      <th className="px-4 py-2.5 text-right border-b border-gray-200 font-bold">
                        Total (tCO₂e)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestRun.results.map((res) => (
                      <tr key={res.period} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5 font-semibold italic">{res.period}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums italic">
                          {fmt(res.electricity_forecast)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums italic">
                          {fmt(res.transportation_forecast)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums italic">
                          {fmt(res.waste_forecast)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold italic">
                          {fmt(res.total_forecast)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section 4: Model Accuracy ─────────────────────────────────── */}
          {latestRun && latestRun.metrics.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-800 mb-1">4. Model Accuracy Metrics</h3>
              <p className="text-xs text-gray-500 mb-4">
                Evaluated on a holdout split of the last 1–3 historical data points. Lower values
                indicate better model fit. MAPE &lt;10% is considered good.
              </p>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left border-b border-gray-200">Factor</th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">
                      MAE (tCO₂e)
                    </th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">
                      RMSE (tCO₂e)
                    </th>
                    <th className="px-4 py-2.5 text-right border-b border-gray-200">MAPE (%)</th>
                    <th className="px-4 py-2.5 text-left border-b border-gray-200">Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {['electricity', 'transportation', 'waste'].map((factor) => {
                    const m = latestRun.metrics.find((x) => x.emission_factor === factor)
                    const mape = m?.mape ?? null
                    const assessment =
                      mape == null ? '—' : mape < 10 ? 'Good' : mape < 20 ? 'Fair' : 'High Error'
                    return (
                      <tr key={factor} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5 font-medium capitalize">{factor}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(m?.mae)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(m?.rmse)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {mape != null ? `${mape.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold">
                          {assessment === 'Good' ? (
                            <span className="text-emerald-600">✓ {assessment}</span>
                          ) : assessment === 'Fair' ? (
                            <span className="text-amber-600">~ {assessment}</span>
                          ) : assessment === 'High Error' ? (
                            <span className="text-red-600">✗ {assessment}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Section 5: Methodology ────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-3">5. Methodology Notes</h3>
            <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p>
                <strong>Data collection:</strong> Annual emission figures (tCO₂e) uploaded manually
                by authorised school personnel, covering electricity, transportation, and waste
                sources.
              </p>
              <p>
                <strong>Forecasting model:</strong> Exponential Smoothing (Holt's method) with
                additive trend and damping, implemented via{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  statsmodels.tsa.holtwinters.ExponentialSmoothing
                </code>
                . Models are fit independently for each emission factor. Damping is applied when
                ≥4 historical data points are available.
              </p>
              <p>
                <strong>Accuracy evaluation:</strong> The last 1–3 historical observations are held
                out, the model is fit on the remainder, and predictions are compared against the
                holdout. MAE, RMSE, and MAPE are computed from these comparisons.
              </p>
              <p>
                <strong>System:</strong> School Carbon Emission Monitoring &amp; Forecasting System
                · Generated {reportDate}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
