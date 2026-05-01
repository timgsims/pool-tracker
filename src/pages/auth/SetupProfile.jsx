import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function SetupProfile() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, refreshRole } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const { error } = await supabase.rpc('complete_signup', { player_name: name.trim() })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    await refreshRole()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <span className="text-5xl">⚫</span>
          <h1 className="text-2xl font-bold text-slate-100 mt-3">One last thing</h1>
          <p className="text-slate-500 text-sm mt-2">
            What name should appear on the leaderboard?
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your display name</label>
              <input
                autoFocus
                className="input"
                placeholder="e.g. Tim"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={30}
                required
              />
              <p className="text-slate-600 text-xs mt-1.5">
                Signed in as {user?.email}
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Setting up…' : 'Get started'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
