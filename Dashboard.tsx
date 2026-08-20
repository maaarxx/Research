// Dashboard overview. Cards and charts are static placeholders for now —
// next step is wiring these to GET /api/emissions/summary and /trends.

const cards = [
  { label: 'Total Emissions', value: '—', unit: 'tCO₂e' },
  { label: 'Electricity', value: '—', unit: 'tCO₂e' },
  { label: 'Transportation', value: '—', unit: 'tCO₂e' },
  { label: 'Waste', value: '—', unit: 'tCO₂e' },
]

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">
        Overview of historical school carbon emissions.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {card.value}{' '}
              <span className="text-sm font-normal text-gray-400">{card.unit}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">No data uploaded yet</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-72 flex items-center justify-center text-sm text-gray-400">
          Total historical emissions trend (line chart) — upload data to populate
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-72 flex items-center justify-center text-sm text-gray-400">
          Emission source breakdown (pie/bar chart) — upload data to populate
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mt-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Key Insights</p>
        <p className="text-sm text-gray-400">
          Insights are generated from stored data once emission records exist.
        </p>
      </div>
    </div>
  )
}
