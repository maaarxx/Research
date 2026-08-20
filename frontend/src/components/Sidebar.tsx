import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/emissions', label: 'Emission Data' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/accuracy', label: 'Model Accuracy' },
  { to: '/reports', label: 'Reports' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white min-h-screen">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-emerald-700 leading-tight">
          Carbon Emission
        </p>
        <p className="text-xs text-gray-500">Monitoring & Forecasting</p>
      </div>
      <nav className="px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
