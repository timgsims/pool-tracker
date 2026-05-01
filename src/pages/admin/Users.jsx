import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const ROLES = ['viewer', 'player', 'admin']

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.rpc('get_all_users'),
      supabase.from('players').select('id, name').eq('active', true).order('name'),
    ])
    setUsers(u ?? [])
    setPlayers(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateRole = async (userId, role) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId)
    if (error) setError(error.message)
    else load()
  }

  const linkPlayer = async (userId, playerId) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ player_id: playerId || null })
      .eq('user_id', userId)
    if (error) setError(error.message)
    else load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-sm">
        All accounts that have signed up. Change roles here or link a user to a player profile.
      </p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th className="pl-5">Email</th>
              <th>Role</th>
              <th>Linked Player</th>
              <th className="text-right pr-5 hidden sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-600">No users yet</td>
              </tr>
            ) : users.map(u => (
              <tr key={u.user_id}>
                <td className="pl-5 text-slate-300 text-sm">{u.email}</td>
                <td>
                  <select
                    className="bg-pool-surface border border-pool-border rounded text-xs px-2 py-1 text-slate-300 focus:outline-none focus:border-pool-accent"
                    value={u.role}
                    onChange={e => updateRole(u.user_id, e.target.value)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="bg-pool-surface border border-pool-border rounded text-xs px-2 py-1 text-slate-300 focus:outline-none focus:border-pool-accent"
                    value={u.player_id ?? ''}
                    onChange={e => linkPlayer(u.user_id, e.target.value)}
                  >
                    <option value="">— unlinked —</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className="text-right pr-5 text-slate-600 text-xs hidden sm:table-cell">
                  {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
