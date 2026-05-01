import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const FORMATS = ['round_robin', 'bracket']

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), format: 'round_robin', seeding: 'ranked_playoff' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, date, format, tournament_participants(player_id)')
        .order('date', { ascending: false }),
      supabase.from('players').select('id, name').eq('active', true).order('name'),
    ])
    setTournaments(t ?? [])
    setPlayers(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createTournament = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('tournaments').insert(form)
    if (error) { setError(error.message); setSaving(false); return }
    setForm({ name: '', date: new Date().toISOString().slice(0, 10), format: 'round_robin', seeding: 'ranked_playoff' })
    setCreating(false)
    setSaving(false)
    load()
  }

  const deleteTournament = async (id) => {
    if (!confirm('Delete this tournament? Match records linked to it will remain.')) return
    await supabase.from('tournaments').delete().eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">{tournaments.length} tournaments</p>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm py-1.5">+ New Tournament</button>
      </div>

      {creating && (
        <div className="card p-5">
          <p className="section-header">New Tournament</p>
          <form onSubmit={createTournament} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                autoFocus className="input" placeholder="e.g. Friday Night Tournament"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Format</label>
                <select className="select" value={form.format}
                  onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                  <option value="round_robin">Round Robin — everyone plays everyone</option>
                  <option value="bracket">Single Elimination — knockout bracket</option>
                </select>
              </div>
            </div>
            {form.format === 'bracket' && (
              <div>
                <label className="label">Seeding method</label>
                <select className="select" value={form.seeding}
                  onChange={e => setForm(f => ({ ...f, seeding: e.target.value }))}>
                  <option value="ranked_playoff">Playoff style — #1 vs lowest seed, protect top seeds to the final</option>
                  <option value="ranked_similar">Similar ranking — #1 vs #2, competitive from round 1</option>
                  <option value="random">Random draw</option>
                </select>
                <p className="text-slate-600 text-xs mt-1">Seeds are based on each player's overall win rate.</p>
              </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create Tournament'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-16" />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">Name</th>
              <th className="text-left">Date</th>
              <th className="text-left">Format</th>
              <th className="text-left">Players</th>
              <th className="text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-600">No tournaments yet</td></tr>
            ) : tournaments.map(t => (
              <tr key={t.id}>
                <td className="pl-5 font-medium text-slate-200">{t.name}</td>
                <td className="text-slate-500 text-sm">
                  {new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="text-slate-500 text-xs capitalize">{t.format.replace('_', ' ')}</td>
                <td className="text-slate-500 text-sm">{t.tournament_participants?.length ?? 0}</td>
                <td className="text-right pr-5 space-x-3">
                  <Link
                    to={`/admin/tournaments/${t.id}`}
                    className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    Manage
                  </Link>
                  <button
                    onClick={() => deleteTournament(t.id)}
                    className="text-red-600 hover:text-red-400 text-xs transition-colors"
                  >
                    Delete
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
