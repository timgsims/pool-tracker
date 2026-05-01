import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const [mode, setMode] = useState('signin')
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

  const switchMode = () => {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
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
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        setMessage('Account created — check your email to confirm, then sign in.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">⚫</span>
          <h1 className="text-2xl font-bold text-slate-100 mt-3">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'signin'
              ? 'Sign in to enter match results'
              : 'Request access to enter results'}
          </p>
        </div>

        {/* Form card */}
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

            <div>
              <label className="label">Password</label>
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
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center border-t border-pool-border pt-4">
            <button onClick={switchMode} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
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
