import { NavLink, Outlet } from 'react-router-dom'

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/players', label: 'Players' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/matches', label: 'Matches' },
  { to: '/admin/tournaments', label: 'Tournaments' },
  { to: '/admin/seasons', label: 'Seasons' },
]

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">Administration</p>
        <h1 className="page-title">Admin</h1>
      </div>

      {/* Admin nav tabs */}
      <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-pool-border pb-0 -mb-px">
        {ADMIN_LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-pool-accent text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
