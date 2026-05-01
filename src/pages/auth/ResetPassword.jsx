import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { recoveryMode } = useAuth()
  const navigate = useNavigate()

  if (!recoveryMode) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No password reset in progress.</p>
          <button onClick={() => navigate('/login')} className="btn-ghost">
            Go to login
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}logo-white.png`}
            alt="Pool Tracker"
            className="h-16 w-auto mx-auto"
          />
          <h1 className="text-2xl font-bold text-slate-100 mt-3">New password</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your new password below</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Same as above"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
