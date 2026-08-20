import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 1): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dec })
}

function pctChange(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

const SOURCE_COLORS = {
  Electricity: '#10b981',
  Transportation: '#3b82f6',
  Waste: '#f59e0b',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [records, setRecords] = useState<EmissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ records: EmissionRecord[] }>('/api/emissions')
      .then(({ records: r }) => setRecords(r))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-gray-400">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
        Loading analytics…
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Analytics</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Analytics</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-semibold text-gray-700">No emission data to analyse yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload records first on the{' '}
            <a href="/emissions" className="text-emerald-600 hover:underline font-medium">
              Emission Data
            </a>{' '}
            page.
          </p>
        </div>
      </div>
    )
  }

  // ── Compute analytics ─────────────────────────────────────────────────────
  const n = records.length
  const totals = {
    electricity: records.reduce((s, r) => s + Number(r.electricity_emissions), 0),
    transportation: records.reduce((s, r) => s + Number(r.transportation_emissions), 0),
    waste: records.reduce((s, r) => s + Number(r.waste_emissions), 0),
    total: records.reduce((s, r) => s + Number(r.total_emissions), 0),
  }
  const avg = totals.total / n
  const peakRec = records.reduce((best, r) =>
    Number(r.total_emissions) > Number(best.total_emissions) ? r : best,
  )
  const minRec = records.reduce((best, r) =>
    Number(r.total_emissions) < Number(best.total_emissions) ? r : best,
  )
  const netChange =
    n >= 2
      ? pctChange(Number(records[n - 1].total_emissions), Number(records[0].total_emissions))
      : null

  // Recharts datasets
  const trendData = records.map((r) => ({
    year: r.year,
    Electricity: Number(r.electricity_emissions),
    Transportation: Number(r.transportation_emissions),
    Waste: Number(r.waste_emissions),
    Total: Number(r.total_emissions),
  }))

  const yoyData = records
    .map((r, i) => {
      if (i === 0) return null
      const prev = records[i - 1]
      const change = pctChange(Number(r.total_emissions), Number(prev.total_emissions))
      return { year: r.year, change: change ?? 0 }
    })
    .filter(Boolean) as { year: number; change: number }[]

  const grandTotal = totals.electricity + totals.transportation + totals.waste
  const pieData = [
    {
      name: 'Electricity',
      value: totals.electricity,
      pct: grandTotal ? (totals.electricity / grandTotal) * 100 : 0,
      fill: SOURCE_COLORS.Electricity,
    },
    {
      name: 'Transportation',
      value: totals.transportation,
      pct: grandTotal ? (totals.transportation / grandTotal) * 100 : 0,
      fill: SOURCE_COLORS.Transportation,
    },
    {
      name: 'Waste',
      value: totals.waste,
      pct: grandTotal ? (totals.waste / grandTotal) * 100 : 0,
      fill: SOURCE_COLORS.Waste,
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Deeper analysis of historical emission patterns — {records[0].year}–
          {records[n - 1].year}.
        </p>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Peak Emission Year',
            value: String(peakRec.year),
            sub: `${fmt(peakRec.total_emissions)} tCO₂e`,
            color: 'text-red-700',
          },
          {
            label: 'Lowest Emission Year',
            value: String(minRec.year),
            sub: `${fmt(minRec.total_emissions)} tCO₂e`,
            color: 'text-emerald-700',
          },
          {
            label: 'Average per Year',
            value: fmt(avg),
            sub: 'tCO₂e',
            color: 'text-gray-900',
          },
          {
            label: 'Net Change',
            value:
              netChange != null
                ? `${netChange >= 0 ? '+' : ''}${netChange.toFixed(1)}%`
                : 'N/A',
            sub: `${records[0].year} → ${records[n - 1].year}`,
            color: netChange != null && netChange >= 0 ? 'text-red-600' : 'text-emerald-600',
          },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* YoY change bar chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">Year-over-Year Change</p>
          <p className="text-xs text-gray-400 mb-4">
            % change in total emissions relative to prior year. Red = increase, green = decrease.
          </p>
          {yoyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              Need at least 2 years of data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yoyData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, 'YoY Change']}
                />
                <Bar dataKey="change" name="YoY Change" radius={[3, 3, 0, 0]}>
                  {yoyData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.change >= 0 ? '#ef4444' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source breakdown pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">Cumulative Source Breakdown</p>
          <p className="text-xs text-gray-400 mb-4">
            Share of total cumulative emissions per source across all years.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="45%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, pct }) => `${name} ${(pct as number).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [`${fmt(v)} tCO₂e`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Full trend line chart ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-4">Full Historical Emission Trend</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="Electricity"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Transportation"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Waste"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Total"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── YoY detail table ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Year-over-Year Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Year</th>
                <th className="px-4 py-3 text-right">Electricity</th>
                <th className="px-4 py-3 text-right">Transportation</th>
                <th className="px-4 py-3 text-right">Waste</th>
                <th className="px-4 py-3 text-right font-bold">Total (tCO₂e)</th>
                <th className="px-4 py-3 text-right">YoY Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r, i) => {
                const prev = records[i - 1]
                const chg = prev
                  ? pctChange(Number(r.total_emissions), Number(prev.total_emissions))
                  : null
                const isPeak = r.year === peakRec.year
                const isMin = r.year === minRec.year && n > 1

                return (
                  <tr
                    key={r.year}
                    className={`hover:bg-gray-50 transition-colors ${isPeak ? 'bg-red-50' : isMin ? 'bg-emerald-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {r.year}
                      {isPeak && (
                        <span className="ml-1.5 text-xs text-red-500 font-normal">↑ peak</span>
                      )}
                      {isMin && (
                        <span className="ml-1.5 text-xs text-emerald-500 font-normal">
                          ↓ lowest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.electricity_emissions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.transportation_emissions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.waste_emissions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmt(r.total_emissions)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {chg == null ? (
                        <span className="text-xs text-gray-400 italic">baseline</span>
                      ) : (
                        <span
                          className={`text-sm font-semibold ${chg >= 0 ? 'text-red-600' : 'text-emerald-600'}`}
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
            {/* Source contribution % footer */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold text-gray-700">
              <tr>
                <td className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Cumulative
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.electricity)}
                  <span className="block text-xs text-gray-400 font-normal">
                    {grandTotal ? ((totals.electricity / grandTotal) * 100).toFixed(0) : 0}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.transportation)}
                  <span className="block text-xs text-gray-400 font-normal">
                    {grandTotal ? ((totals.transportation / grandTotal) * 100).toFixed(0) : 0}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.waste)}
                  <span className="block text-xs text-gray-400 font-normal">
                    {grandTotal ? ((totals.waste / grandTotal) * 100).toFixed(0) : 0}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.total)}</td>
                <td className="px-4 py-3 text-right">
                  {netChange != null && (
                    <span
                      className={`text-sm font-bold ${netChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`}
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
    </div>
  )
}
