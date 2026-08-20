import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/emissions', label: 'Emission Data', icon: '📁' },
  { to: '/forecast', label: 'Forecast', icon: '📈' },
  { to: '/analytics', label: 'Analytics', icon: '🔍' },
  { to: '/accuracy', label: 'Model Accuracy', icon: '🎯' },
  { to: '/reports', label: 'Reports', icon: '📄' },
]

export default function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-emerald-700 leading-tight">Carbon Emission</p>
        <p className="text-xs text-gray-500">Monitoring &amp; Forecasting</p>
      </div>

      {/* Nav links */}
      <nav className="px-3 py-4 space-y-0.5 flex-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base leading-none">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          id="sign-out-btn"
          onClick={onSignOut}
          className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <span className="text-base leading-none">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
