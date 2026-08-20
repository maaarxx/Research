import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
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

interface Summary {
  total: number | null
  electricity: number | null
  transportation: number | null
  waste: number | null
  recordCount: number
  yearRange: string | null
}

interface Trends {
  years: number[]
  electricity: number[]
  transportation: number[]
  waste: number[]
  total: number[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, t] = await Promise.all([
          apiGet<Summary>('/api/emissions/summary'),
          apiGet<Trends>('/api/emissions/trends'),
        ])
        setSummary(s)
        setTrends(t)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Recharts expects an array of objects
  const chartData =
    trends?.years.map((year, i) => ({
      year,
      Electricity: trends.electricity[i],
      Transportation: trends.transportation[i],
      Waste: trends.waste[i],
      Total: trends.total[i],
    })) ?? []

  const hasData = chartData.length > 0

  const cards = [
    {
      label: 'Total Emissions',
      value: summary?.total,
      unit: 'tCO₂e',
      color: 'text-gray-700',
    },
    {
      label: 'Electricity',
      value: summary?.electricity,
      unit: 'tCO₂e',
      color: 'text-emerald-700',
    },
    {
      label: 'Transportation',
      value: summary?.transportation,
      unit: 'tCO₂e',
      color: 'text-blue-700',
    },
    {
      label: 'Waste',
      value: summary?.waste,
      unit: 'tCO₂e',
      color: 'text-amber-700',
    },
  ]

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of historical school carbon emissions
          {summary?.yearRange ? ` — ${summary.yearRange}` : ''}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${card.color}`}>
              {loading ? (
                <span className="text-gray-300">…</span>
              ) : (
                fmt(card.value)
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{card.unit}</p>
            {!loading && summary?.recordCount != null && (
              <p className="mt-2 text-xs text-gray-400">
                {summary.recordCount > 0
                  ? `${summary.recordCount} year${summary.recordCount > 1 ? 's' : ''} on record`
                  : 'No data uploaded yet'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Line chart — historical trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Historical Emissions Trend</p>
          {loading ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">
              Loading…
            </div>
          ) : !hasData ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <span className="text-2xl">📤</span>
              Upload emission data to populate this chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
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
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Transportation"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Waste"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
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
          )}
        </div>

        {/* Bar chart — source breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Emission Source Breakdown</p>
          {loading ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">
              Loading…
            </div>
          ) : !hasData ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <span className="text-2xl">📊</span>
              Upload emission data to populate this chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Electricity" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Transportation" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Waste" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">Key Insights</p>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !hasData ? (
          <p className="text-sm text-gray-400">
            Insights are generated from stored data once emission records exist. Go to{' '}
            <a href="/emissions" className="text-emerald-600 hover:underline">
              Emission Data
            </a>{' '}
            to upload your first file.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>
              •{' '}
              <strong>{summary?.recordCount}</strong> year
              {summary?.recordCount !== 1 ? 's' : ''} of data on record ({summary?.yearRange})
            </li>
            <li>
              • Total cumulative emissions:{' '}
              <strong>{fmt(summary?.total)} tCO₂e</strong>
            </li>
            {chartData.length >= 2 && (() => {
              const last = chartData[chartData.length - 1]
              const prev = chartData[chartData.length - 2]
              if (!prev.Total || prev.Total === 0) return null
              const pct = ((last.Total - prev.Total) / Math.abs(prev.Total)) * 100
              return (
                <li key="yoy">
                  • YoY change ({prev.year}→{last.year}):{' '}
                  <strong className={pct >= 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {pct >= 0 ? '+' : ''}
                    {pct.toFixed(1)}%
                  </strong>
                </li>
              )
            })()}
            {(() => {
              if (chartData.length === 0) return null
              const peak = chartData.reduce((best, d) => (d.Total > best.Total ? d : best))
              return (
                <li key="peak">
                  • Highest emission year: <strong>{peak.year}</strong> ({fmt(peak.Total)} tCO₂e)
                </li>
              )
            })()}
          </ul>
        )}
      </div>
    </div>
  )
}
