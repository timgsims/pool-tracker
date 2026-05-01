import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const ROLES = ['viewer', 'player', 'admin']

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)

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

  const deleteUser = async (userId, email) => {
    if (!confirm(`Permanently delete ${email}?\n\nThis will also delete their player profile and ALL match results they were involved in. This cannot be undone.`)) return
    setDeleting(userId)
    setError('')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    if (error) {
      setError(error.message)
      setDeleting(null)
    } else {
      setDeleting(null)
      load()
    }
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

      <div className="card overflow-x-auto">
        <table className="table-base">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-24 hidden sm:table-column" />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">Email</th>
              <th className="text-left">Role</th>
              <th className="text-left">Linked Player</th>
              <th className="text-right hidden sm:table-cell">Joined</th>
              <th className="text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-600">No users yet</td>
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
                <td className="text-right text-slate-600 text-xs hidden sm:table-cell">
                  {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="text-right pr-5">
                  <button
                    onClick={() => deleteUser(u.user_id, u.email)}
                    disabled={deleting === u.user_id}
                    className="text-red-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                  >
                    {deleting === u.user_id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
