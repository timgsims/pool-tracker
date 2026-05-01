import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../ui/Avatar'

const NAV_LINKS = [
  { to: '/', label: 'Leaderboard', end: true },
  { to: '/matches', label: 'Matches' },
  { to: '/tournaments', label: 'Tournaments' },
]

export default function Navbar() {
  const { isAuthenticated, isAdmin, isPlayer, signOut, linkedPlayerName, linkedPlayerAvatar } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-pool-border bg-pool-surface/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}logo-white.png`}
            alt="Pool Tracker"
            className="h-8 w-auto"
          />
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-slate-100 bg-pool-elevated'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-pool-elevated'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated ? (
            <>
              {isPlayer && (
                <Link to="/enter-result" className="btn-primary text-sm py-1.5">
                  + Result
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="btn-ghost text-sm py-1.5">
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                {linkedPlayerName && (
                  <Avatar name={linkedPlayerName} src={linkedPlayerAvatar} size="sm" />
                )}
                <button
                  onClick={handleSignOut}
                  className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="text-slate-600 hover:text-slate-400 text-sm transition-colors px-2"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
