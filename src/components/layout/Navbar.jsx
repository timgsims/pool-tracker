import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../ui/Avatar'

const NAV_LINKS = [
  { to: '/', label: 'Leaderboard', end: true },
  { to: '/matches', label: 'Matches' },
  { to: '/players', label: 'Players' },
  { to: '/stats', label: 'Stats' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/tournament-stats', label: 'Tournament Stats' },
]

export default function Navbar() {
  const { isAuthenticated, isAdmin, isPlayer, signOut, linkedPlayerName, linkedPlayerAvatar } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-pool-border bg-pool-surface/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo — dropdown trigger */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 focus:outline-none"
            aria-label="Navigation menu"
          >
            <img
              src={`${import.meta.env.BASE_URL}icon-white-bg.png`}
              alt="Pool Tracker"
              className="h-8 w-auto rounded"
            />
            <span className="text-slate-400 text-xs font-semibold tracking-widest uppercase">Menu</span>
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 mt-2 bg-pool-card border border-pool-border rounded-xl shadow-xl py-1.5 z-50 min-w-44">
              {NAV_LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-slate-100 bg-pool-elevated'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-pool-elevated'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
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
                  <Link to="/account-settings" className="rounded-full ring-2 ring-transparent hover:ring-pool-accent transition-all">
                    <Avatar name={linkedPlayerName} src={linkedPlayerAvatar} size="sm" />
                  </Link>
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
