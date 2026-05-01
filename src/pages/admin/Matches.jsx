import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateShort, isoToNZLocal, nzLocalToISO } from '../../lib/dateUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function EditMatchModal({ match, allPlayers, onClose, onSaved }) {
  const [p1, setP1] = useState(match.player1?.id ?? '')
  const [p2, setP2] = useState(match.player2?.id ?? '')
  const [playedAt, setPlayedAt] = useState(isoToNZLocal(match.played_at))
  const [winner, setWinner] = useState(match.winner?.id ?? '')
  const [gameWinners, setGameWinners] = useState(() => {
    const sorted = [...(match.games ?? [])].sort((a, b) => a.game_number - b.game_number)
    return [sorted[0]?.winner_id ?? '', sorted[1]?.winner_id ?? '', sorted[2]?.winner_id ?? '']
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const player1 = allPlayers.find(p => p.id === p1)
  const player2 = allPlayers.find(p => p.id === p2)

  // Clear winner if they're no longer one of the selected players
  useEffect(() => {
    if (winner && winner !== p1 && winner !== p2) setWinner('')
  }, [p1, p2, winner])

  const setGame = (i, val) => {
    const updated = [...gameWinners]
    updated[i] = val
    setGameWinners(updated)
  }

  const handleSave = async () => {
    if (!p1 || !p2) { setError('Select both players'); return }
    if (p1 === p2) { setError('Players must be different'); return }
    setSaving(true)
    setError('')
    try {
      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          player1_id: p1,
          player2_id: p2,
          played_at: nzLocalToISO(playedAt),
          format: 'best_of_3',
          winner_id: winner || null,
        })
        .eq('id', match.id)
      if (matchErr) throw matchErr

      await supabase.from('games').delete().eq('match_id', match.id)

      const games = gameWinners
        .map((w, i) => w ? { match_id: match.id, game_number: i + 1, winner_id: w } : null)
        .filter(Boolean)
      if (games.length) {
        const { error: gErr } = await supabase.from('games').insert(games)
        if (gErr) throw gErr
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-pool-card border border-pool-border rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-100">Edit Match</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Player 1</label>
            <select className="select text-sm" value={p1} onChange={e => setP1(e.target.value)}>
              <option value="">Select…</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Player 2</label>
            <select className="select text-sm" value={p2} onChange={e => setP2(e.target.value)}>
              <option value="">Select…</option>
              {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Date &amp; Time (NZ)</label>
          <input
            type="datetime-local"
            className="input text-sm"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
          />
        </div>

        {p1 && p2 && (
          <div>
            <label className="label">Game results</label>
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs w-12 shrink-0">Game {i + 1}</span>
                  <select
                    className="select text-sm"
                    value={gameWinners[i]}
                    onChange={e => setGame(i, e.target.value)}
                  >
                    <option value="">— not played —</option>
                    {player1 && <option value={player1.id}>{player1.name}</option>}
                    {player2 && <option value={player2.id}>{player2.name}</option>}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Match winner</label>
          <select className="select text-sm" value={winner} onChange={e => setWinner(e.target.value)}>
            <option value="">— no result —</option>
            {player1 && <option value={player1.id}>{player1.name}</option>}
            {player2 && <option value={player2.id}>{player2.name}</option>}
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminMatches() {
  const [matches, setMatches] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = () =>
    Promise.all([
      supabase
        .from('matches')
        .select(`
          id, played_at, format,
          player1:player1_id(id, name),
          player2:player2_id(id, name),
          winner:winner_id(id, name),
          games(game_number, winner_id)
        `)
        .order('played_at', { ascending: false }),
      supabase
        .from('players')
        .select('id, name')
        .eq('active', true)
        .order('name'),
    ]).then(([{ data: m }, { data: p }]) => {
      setMatches(m ?? [])
      setAllPlayers(p ?? [])
      setLoading(false)
    })

  useEffect(() => { load() }, [])

  const deleteMatch = async (id) => {
    if (!confirm('Delete this match and all its game results? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('matches').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {editing && (
        <EditMatchModal
          match={editing}
          allPlayers={allPlayers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      <p className="text-slate-500 text-sm">
        {matches.length} matches total. Deleting a match also removes its individual game records.
      </p>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <colgroup>
            <col className="w-24" />
            <col />
            <col className="w-14" />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">Date</th>
              <th className="text-left">Match</th>
              <th className="text-left">Format</th>
              <th className="text-left">Winner</th>
              <th className="text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-600">No matches yet</td></tr>
            ) : matches.map(m => {
              const { left, right } = orderedMatch(m)
              return (
                <tr key={m.id}>
                  <td className="pl-5 text-slate-500 text-xs font-mono whitespace-nowrap">
                    {formatDateShort(m.played_at)}
                  </td>
                  <td className="text-slate-200 text-sm">
                    {left?.name} vs {right?.name}
                  </td>
                  <td className="text-slate-600 text-xs">
                    {m.format === 'best_of_3' ? 'Bo3' : '1G'}
                  </td>
                  <td className="text-sm">
                    {m.winner
                      ? <span className="text-pool-accent text-xs">{m.winner.name}</span>
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="text-right pr-5 space-x-3">
                    <button
                      onClick={() => setEditing(m)}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMatch(m.id)}
                      disabled={deleting === m.id}
                      className="text-red-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                    >
                      {deleting === m.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
