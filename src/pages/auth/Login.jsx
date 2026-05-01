import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const RESET_REDIRECT = `${window.location.origin}${import.meta.env.VITE_BASE_PATH || '/'}`

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn, signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) throw error
        setMessage('Account created — check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: RESET_REDIRECT,
        })
        if (error) throw error
        setMessage('Reset link sent — check your email.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'
  const subtitle = mode === 'signin'
    ? 'Sign in to enter match results'
    : mode === 'signup'
    ? 'Request access to enter results'
    : "We'll email you a reset link"

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}logo-white.png`}
            alt="Pool Tracker"
            className="h-48 w-auto mx-auto"
          />
          <h1 className="text-2xl font-bold text-slate-100 mt-3">{title}</h1>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            {message && (
              <div className="text-sm text-pool-win bg-green-950/40 border border-green-900/50 rounded-lg px-3 py-2.5">
                {message}
              </div>
            )}

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'signin' ? 'Sign in'
                : mode === 'signup' ? 'Create account'
                : 'Send reset link'}
            </button>
          </form>

          <div className="mt-5 text-center border-t border-pool-border pt-4 space-y-2">
            {mode !== 'signin' && (
              <button
                onClick={() => switchMode('signin')}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors block w-full"
              >
                Back to sign in
              </button>
            )}
            {mode === 'signin' && (
              <button
                onClick={() => switchMode('signup')}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors block w-full"
              >
                Don't have an account? Sign up
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link to="/" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}
