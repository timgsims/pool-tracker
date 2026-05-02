import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function computeSeasonStandings(matches, players) {
  const stats = {}
  for (const p of players) stats[p.id] = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (!m.winner_id) continue
    if (stats[m.winner_id] !== undefined) stats[m.winner_id].wins++
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
    if (stats[loserId] !== undefined) stats[loserId].losses++
  }
  return players
    .map(p => ({ ...p, ...stats[p.id] }))
    .filter(p => p.wins + p.losses > 0)
    .sort((a, b) => {
      const ra = a.wins / (a.wins + a.losses)
      const rb = b.wins / (b.wins + b.losses)
      return rb - ra || b.wins - a.wins
    })
}

function CompleteModal({ season, players, onConfirm, onClose }) {
  const [standings, setStandings] = useState([])
  const [champion, setChampion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('matches')
      .select('player1_id, player2_id, winner_id')
      .gte('played_at', season.start_date)
      .lte('played_at', season.end_date + 'T23:59:59')
      .not('winner_id', 'is', null)
      .then(({ data }) => {
        const s = computeSeasonStandings(data ?? [], players)
        setStandings(s)
        if (s.length > 0) setChampion(s[0].id)
        setLoading(false)
      })
  }, [season.id])

  const handleConfirm = async () => {
    if (!champion) return
    setSaving(true)
    await onConfirm(champion)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-pool-card border border-pool-border rounded-xl w-full max-w-sm p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="font-semibold text-slate-100 text-lg">Complete Season</h2>
          <p className="text-slate-500 text-sm mt-0.5">{season.name}</p>
        </div>

        {loading ? (
          <div className="py-4 text-center text-slate-600 text-sm">Loading season results…</div>
        ) : standings.length === 0 ? (
          <p className="text-slate-600 text-sm">No matches recorded in this season.</p>
        ) : (
          <div className="space-y-2">
            <p className="label">Select season champion</p>
            {standings.map((p, i) => {
              const total = p.wins + p.losses
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    champion === p.id
                      ? 'border-amber-600/60 bg-amber-900/20'
                      : 'border-pool-border hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="champion"
                    value={p.id}
                    checked={champion === p.id}
                    onChange={() => setChampion(p.id)}
                    className="accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 text-sm">{p.name}</p>
                    <p className="text-slate-600 text-xs">
                      {p.wins}W – {p.losses}L · {Math.round((p.wins / total) * 100)}% win rate
                    </p>
                  </div>
                  {i === 0 && (
                    <span className="text-amber-400 text-xs font-semibold shrink-0">Top seed</span>
                  )}
                </label>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            disabled={saving || !champion || loading}
            className="btn-primary flex-1"
          >
            {saving ? 'Completing…' : 'Complete Season 🏆'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSeasons() {
  const [seasons, setSeasons] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)

  // Edit end date
  const [editingId, setEditingId] = useState(null)
  const [editEnd, setEditEnd] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Complete modal
  const [completing, setCompleting] = useState(null)

  const load = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('seasons').select('*, champion:champion_player_id(id, name)').order('start_date', { ascending: false }),
      supabase.from('players').select('id, name').eq('active', true).order('name'),
    ])
    setSeasons(s ?? [])
    setPlayers(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const activeSeason = seasons.find(s => s.is_active)
  const completedSeasons = seasons.filter(s => s.completed).sort((a, b) => b.end_date.localeCompare(a.end_date))

  const createSeason = async (e) => {
    e.preventDefault()
    if (activeSeason) { setError('Complete the current season before starting a new one.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('seasons').insert({ ...form, is_active: true })
    if (error) { setError(error.message); setSaving(false); return }
    setForm({ name: '', start_date: '', end_date: '' })
    setCreating(false)
    setSaving(false)
    load()
  }

  const saveEndDate = async (id) => {
    setSavingEdit(true)
    setError('')
    const { error } = await supabase.from('seasons').update({ end_date: editEnd }).eq('id', id)
    if (error) { setError(error.message); setSavingEdit(false); return }
    setSavingEdit(false)
    setEditingId(null)
    load()
  }

  const completeSeason = async (championId) => {
    setError('')
    const { error } = await supabase
      .from('seasons')
      .update({ completed: true, is_active: false, champion_player_id: championId })
      .eq('id', completing.id)
    if (error) { setError(error.message); return }
    setCompleting(null)
    load()
  }

  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {completing && (
        <CompleteModal
          season={completing}
          players={players}
          onConfirm={completeSeason}
          onClose={() => setCompleting(null)}
        />
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Active season */}
      {activeSeason ? (
        <div className="border border-pool-accent/30 bg-pool-accent/5 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-pool-accent uppercase tracking-wider">Active Season</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 mt-1">{activeSeason.name}</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                {formatDate(activeSeason.start_date)} →{' '}
                {editingId === activeSeason.id ? (
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="date"
                      className="input py-0.5 text-xs inline-block w-auto h-auto"
                      value={editEnd}
                      onChange={e => setEditEnd(e.target.value)}
                    />
                    <button onClick={() => saveEndDate(activeSeason.id)} disabled={savingEdit} className="text-pool-accent text-xs hover:text-pool-accent-dim transition-colors">
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs hover:text-slate-300 transition-colors">Cancel</button>
                  </span>
                ) : (
                  <>
                    {formatDate(activeSeason.end_date)}
                    <button
                      onClick={() => { setEditingId(activeSeason.id); setEditEnd(activeSeason.end_date) }}
                      className="ml-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      Edit end date
                    </button>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => setCompleting(activeSeason)}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-400 hover:bg-amber-900/50 text-sm font-medium transition-colors"
            >
              Complete Season
            </button>
          </div>
        </div>
      ) : (
        <div>
          {!creating ? (
            <div className="card p-8 text-center space-y-3">
              <p className="text-slate-400 font-medium">No active season</p>
              <p className="text-slate-600 text-sm">Start a new season to track standings and award a champion.</p>
              <button onClick={() => setCreating(true)} className="btn-primary">Start New Season</button>
            </div>
          ) : (
            <div className="card p-5">
              <p className="section-header">New Season</p>
              <form onSubmit={createSeason} className="space-y-3">
                <div>
                  <label className="label">Season name</label>
                  <input
                    autoFocus
                    className="input"
                    placeholder="e.g. 2026 Season"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Start date</label>
                  <input type="date" className="input" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">End date</label>
                  <input type="date" className="input" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Creating…' : 'Create & Activate'}
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Completed seasons */}
      {completedSeasons.length > 0 && (
        <div>
          <p className="section-header">Past Seasons</p>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <colgroup>
                <col />
                <col className="w-36" />
                <col className="w-36" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="pl-5 text-left">Season</th>
                  <th className="text-left">Start</th>
                  <th className="text-left">End</th>
                  <th className="text-left pr-5">Champion</th>
                </tr>
              </thead>
              <tbody>
                {completedSeasons.map(s => (
                  <tr key={s.id}>
                    <td className="pl-5 font-medium text-slate-200">{s.name}</td>
                    <td className="text-slate-500 text-sm">{formatDate(s.start_date)}</td>
                    <td className="text-slate-500 text-sm">{formatDate(s.end_date)}</td>
                    <td className="pr-5">
                      {s.champion
                        ? <span className="text-amber-400 font-semibold text-sm">🏆 {s.champion.name}</span>
                        : <span className="text-slate-600 text-sm">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
