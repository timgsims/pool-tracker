import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function SetupProfile() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, refreshRole } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    if (!firstName.trim() || !lastName.trim()) return
    setLoading(true)
    setError('')

    const { error } = await supabase.rpc('complete_signup', { player_name: fullName })
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
          <img
            src={`${import.meta.env.BASE_URL}logo-white.png`}
            alt="Pool Tracker"
            className="h-48 w-auto mx-auto"
          />
          <h1 className="text-2xl font-bold text-slate-100 mt-3">One last thing</h1>
          <p className="text-slate-500 text-sm mt-2">
            Enter your name as it will appear on the leaderboard.
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input
                  autoFocus
                  className="input"
                  placeholder="Tim"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  className="input"
                  placeholder="Stewart"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>
            </div>
            <p className="text-slate-600 text-xs">
              Signed in as {user?.email}
            </p>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || !firstName.trim() || !lastName.trim()}
            >
              {loading ? 'Setting up…' : 'Get started'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
