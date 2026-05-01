import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    supabase
      .from('players')
      .select('id, name, active, created_at')
      .order('name')
      .then(({ data }) => { setPlayers(data ?? []); setLoading(false) })

  useEffect(() => { load() }, [])

  const addPlayer = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('players').insert({ name: newName.trim() })
    if (error) { setError(error.message); setSaving(false); return }
    setNewName('')
    setAdding(false)
    setSaving(false)
    load()
  }

  const toggleActive = async (id, current) => {
    await supabase.from('players').update({ active: !current }).eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{players.filter(p => p.active).length} active players</p>
        <button onClick={() => setAdding(true)} className="btn-primary text-sm py-1.5">
          + Add Player
        </button>
      </div>

      {adding && (
        <div className="card p-4">
          <form onSubmit={addPlayer} className="flex gap-3">
            <input
              autoFocus
              className="input"
              placeholder="Player name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary shrink-0" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button type="button" className="btn-secondary shrink-0" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th className="pl-5">Name</th>
              <th>Status</th>
              <th className="text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id}>
                <td className="pl-5 font-medium text-slate-200">{p.name}</td>
                <td>
                  {p.active
                    ? <span className="badge-green">Active</span>
                    : <span className="badge-gray">Inactive</span>}
                </td>
                <td className="text-right pr-5">
                  <button
                    onClick={() => toggleActive(p.id, p.active)}
                    className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    {p.active ? 'Deactivate' : 'Reactivate'}
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
