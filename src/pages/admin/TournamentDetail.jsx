import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { nowNZLocal, isoToNZLocal, nzLocalToISO, formatDateShort } from '../../lib/dateUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function deriveWinner(games, p1id, p2id) {
  let w1 = 0, w2 = 0
  for (const g of games) {
    if (g === p1id) w1++
    else if (g === p2id) w2++
  }
  if (w1 >= 2) return p1id
  if (w2 >= 2) return p2id
  return null
}

function computeStandings(participantIds, matches) {
  const stats = {}
  for (const pid of participantIds) stats[pid] = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (!m.winner_id) continue
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
    if (stats[m.winner_id] !== undefined) stats[m.winner_id].wins++
    if (stats[loserId] !== undefined) stats[loserId].losses++
  }
  return stats
}

export default function AdminTournamentDetail() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const [participants, setParticipants] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Participants editing
  const [editingParts, setEditingParts] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [savingParts, setSavingParts] = useState(false)

  // Recording a match
  const [recording, setRecording] = useState(false)
  const [mP1, setMP1] = useState('')
  const [mP2, setMP2] = useState('')
  const [mPlayedAt, setMPlayedAt] = useState(nowNZLocal)
  const [mGames, setMGames] = useState(['', '', ''])
  const [savingMatch, setSavingMatch] = useState(false)
  const [matchError, setMatchError] = useState('')

  // Final positions
  const [editingPos, setEditingPos] = useState(false)
  const [posMap, setPosMap] = useState({})
  const [savingPos, setSavingPos] = useState(false)

  const load = async () => {
    const [{ data: t }, { data: p }, { data: parts }, { data: m }] = await Promise.all([
      supabase.from('tournaments').select('id, name, date, format').eq('id', id).single(),
      supabase.from('players').select('id, name').eq('active', true).order('name'),
      supabase
        .from('tournament_participants')
        .select('player_id, final_position, player:player_id(id, name)')
        .eq('tournament_id', id),
      supabase
        .from('matches')
        .select(`
          id, played_at, winner_id, player1_id, player2_id,
          player1:player1_id(id, name),
          player2:player2_id(id, name),
          winner:winner_id(id, name),
          games(game_number, winner_id)
        `)
        .eq('tournament_id', id)
        .order('played_at', { ascending: false }),
    ])
    setTournament(t)
    setAllPlayers(p ?? [])
    setParticipants(parts ?? [])
    setMatches(m ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const participantIds = participants.map(p => p.player_id)
  const nameOf = id => participants.find(p => p.player_id === id)?.player?.name ?? ''

  // ── Participants ──────────────────────────────────────────────────────────────

  const openEditParts = () => {
    setSelectedIds(new Set(participantIds))
    setEditingParts(true)
  }

  const togglePlayer = pid => {
    const next = new Set(selectedIds)
    if (next.has(pid)) next.delete(pid); else next.add(pid)
    setSelectedIds(next)
  }

  const saveParticipants = async () => {
    setSavingParts(true)
    setError('')
    await supabase.from('tournament_participants').delete().eq('tournament_id', id)
    if (selectedIds.size > 0) {
      const rows = [...selectedIds].map(pid => ({ tournament_id: id, player_id: pid }))
      const { error: e } = await supabase.from('tournament_participants').insert(rows)
      if (e) { setError(e.message); setSavingParts(false); return }
    }
    setSavingParts(false)
    setEditingParts(false)
    load()
  }

  // ── Record match ──────────────────────────────────────────────────────────────

  const openRecord = () => {
    setMP1(''); setMP2('')
    setMPlayedAt(nowNZLocal())
    setMGames(['', '', ''])
    setMatchError('')
    setRecording(true)
  }

  const setGame = (i, val) => {
    const g = [...mGames]; g[i] = val; setMGames(g)
  }

  const recordMatch = async () => {
    if (!mP1 || !mP2) { setMatchError('Select both players'); return }
    setSavingMatch(true)
    setMatchError('')
    const winnerId = deriveWinner(mGames, mP1, mP2)
    const { data: newMatch, error: mErr } = await supabase
      .from('matches')
      .insert({
        player1_id: mP1,
        player2_id: mP2,
        played_at: nzLocalToISO(mPlayedAt),
        format: 'best_of_3',
        winner_id: winnerId,
        tournament_id: id,
      })
      .select('id')
      .single()
    if (mErr) { setMatchError(mErr.message); setSavingMatch(false); return }

    const games = mGames
      .map((w, i) => w ? { match_id: newMatch.id, game_number: i + 1, winner_id: w } : null)
      .filter(Boolean)
    if (games.length) await supabase.from('games').insert(games)

    setRecording(false)
    setSavingMatch(false)
    load()
  }

  const removeMatch = async matchId => {
    if (!confirm('Remove this match from the tournament? The result stays in overall history.')) return
    await supabase.from('matches').update({ tournament_id: null }).eq('id', matchId)
    load()
  }

  // ── Positions ─────────────────────────────────────────────────────────────────

  const openEditPos = () => {
    setPosMap(Object.fromEntries(participants.map(p => [p.player_id, p.final_position ? String(p.final_position) : ''])))
    setEditingPos(true)
  }

  const autoFillPositions = () => {
    const standings = computeStandings(participantIds, matches)
    const sorted = [...participantIds].sort((a, b) => {
      const wa = standings[a]?.wins ?? 0, wb = standings[b]?.wins ?? 0
      if (wb !== wa) return wb - wa
      return (standings[a]?.losses ?? 0) - (standings[b]?.losses ?? 0)
    })
    setPosMap(Object.fromEntries(sorted.map((pid, i) => [pid, String(i + 1)])))
  }

  const savePositions = async () => {
    setSavingPos(true)
    setError('')
    for (const pid of participantIds) {
      const pos = posMap[pid] ? parseInt(posMap[pid], 10) : null
      await supabase
        .from('tournament_participants')
        .update({ final_position: pos })
        .eq('tournament_id', id)
        .eq('player_id', pid)
    }
    setSavingPos(false)
    setEditingPos(false)
    load()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />
  if (!tournament) return <div className="text-slate-500 p-8">Tournament not found.</div>

  const standings = computeStandings(participantIds, matches)
  const sortedByStandings = [...participantIds].sort((a, b) => {
    const wa = standings[a]?.wins ?? 0, wb = standings[b]?.wins ?? 0
    if (wb !== wa) return wb - wa
    return (standings[a]?.losses ?? 0) - (standings[b]?.losses ?? 0)
  })

  const mPlayer1 = allPlayers.find(p => p.id === mP1)
  const mPlayer2 = allPlayers.find(p => p.id === mP2)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/tournaments" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← All tournaments
        </Link>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">{tournament.name}</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date(tournament.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}
          <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
        </p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Participants */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-header">Participants ({participants.length})</p>
          {!editingParts && (
            <button onClick={openEditParts} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              Edit
            </button>
          )}
        </div>

        {editingParts ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {allPlayers.map(p => {
                const on = selectedIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      on
                        ? 'bg-pool-accent/20 border-pool-accent text-pool-accent'
                        : 'bg-pool-surface border-pool-border text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={saveParticipants} disabled={savingParts} className="btn-primary text-sm py-1.5">
                {savingParts ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingParts(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            </div>
          </div>
        ) : participants.length === 0 ? (
          <p className="text-slate-600 text-sm">No participants yet — click Edit to add players.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <span key={p.player_id} className="px-3 py-1.5 rounded-full text-sm bg-pool-surface border border-pool-border text-slate-300">
                {p.player?.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Standings */}
      {participantIds.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-5 pt-4 pb-2">
            <p className="section-header">Standings</p>
          </div>
          <table className="table-base">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr>
                <th className="pl-5 text-left">#</th>
                <th className="text-left">Player</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-right pr-5">Win%</th>
              </tr>
            </thead>
            <tbody>
              {sortedByStandings.map((pid, i) => {
                const s = standings[pid]
                const total = (s?.wins ?? 0) + (s?.losses ?? 0)
                return (
                  <tr key={pid}>
                    <td className="pl-5 text-slate-600 text-xs font-mono">{i + 1}</td>
                    <td className="font-medium text-slate-200">{nameOf(pid)}</td>
                    <td className="text-center win-text tabular-nums text-sm">{s?.wins ?? 0}</td>
                    <td className="text-center loss-text tabular-nums text-sm">{s?.losses ?? 0}</td>
                    <td className="text-right pr-5 text-slate-400 tabular-nums text-sm">
                      {total > 0 ? `${Math.round((s.wins / total) * 100)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Matches */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-header">Matches ({matches.length})</p>
          {!recording && participantIds.length >= 2 && (
            <button onClick={openRecord} className="btn-primary text-sm py-1.5">+ Record Match</button>
          )}
        </div>

        {recording && (
          <div className="border border-pool-border rounded-lg p-4 space-y-3 bg-pool-surface">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Player 1</label>
                <select className="select text-sm" value={mP1} onChange={e => setMP1(e.target.value)}>
                  <option value="">Select…</option>
                  {participants.map(p => (
                    <option key={p.player_id} value={p.player_id}>{p.player?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Player 2</label>
                <select className="select text-sm" value={mP2} onChange={e => setMP2(e.target.value)}>
                  <option value="">Select…</option>
                  {participants.filter(p => p.player_id !== mP1).map(p => (
                    <option key={p.player_id} value={p.player_id}>{p.player?.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Date &amp; Time (NZ)</label>
              <input
                type="datetime-local"
                className="input text-sm"
                value={mPlayedAt}
                onChange={e => setMPlayedAt(e.target.value)}
              />
            </div>

            {mP1 && mP2 && (
              <div>
                <label className="label">Game results</label>
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-12 shrink-0">Game {i + 1}</span>
                      <select
                        className="select text-sm"
                        value={mGames[i]}
                        onChange={e => setGame(i, e.target.value)}
                      >
                        <option value="">— not played —</option>
                        {mPlayer1 && <option value={mPlayer1.id}>{mPlayer1.name}</option>}
                        {mPlayer2 && <option value={mPlayer2.id}>{mPlayer2.name}</option>}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchError && <p className="text-red-400 text-sm">{matchError}</p>}

            <div className="flex gap-2">
              <button onClick={recordMatch} disabled={savingMatch} className="btn-primary text-sm py-1.5">
                {savingMatch ? 'Saving…' : 'Save Match'}
              </button>
              <button onClick={() => setRecording(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {matches.length === 0 ? (
          <p className="text-slate-600 text-sm">
            {participantIds.length < 2 ? 'Add at least 2 participants first.' : 'No matches recorded yet.'}
          </p>
        ) : (
          <div className="divide-y divide-pool-border/40">
            {matches.map(m => {
              const sorted = [...(m.games ?? [])].sort((a, b) => a.game_number - b.game_number)
              const s1 = sorted.filter(g => g.winner_id === m.player1_id).length
              const s2 = sorted.filter(g => g.winner_id === m.player2_id).length
              return (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="text-sm">
                    <span className={m.winner_id === m.player1_id ? 'text-slate-100 font-semibold' : 'text-slate-500'}>
                      {m.player1?.name}
                    </span>
                    <span className="text-slate-600 mx-2 font-mono text-xs">
                      {sorted.length > 0 ? `${s1}–${s2}` : 'vs'}
                    </span>
                    <span className={m.winner_id === m.player2_id ? 'text-slate-100 font-semibold' : 'text-slate-500'}>
                      {m.player2?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-600 text-xs">{formatDateShort(m.played_at)}</span>
                    <button
                      onClick={() => removeMatch(m.id)}
                      className="text-red-700 hover:text-red-500 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Final Positions */}
      {participantIds.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-header">Final Positions</p>
            {!editingPos && (
              <button onClick={openEditPos} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                Edit
              </button>
            )}
          </div>

          {editingPos ? (
            <div className="space-y-3">
              {matches.length > 0 && (
                <button
                  onClick={autoFillPositions}
                  className="text-xs text-pool-accent hover:text-pool-accent-dim transition-colors"
                >
                  Auto-fill from standings
                </button>
              )}
              <div className="space-y-2">
                {participantIds.map(pid => (
                  <div key={pid} className="flex items-center gap-3">
                    <span className="text-slate-300 text-sm w-32 shrink-0">{nameOf(pid)}</span>
                    <input
                      type="number" min="1" placeholder="—"
                      className="input py-1 text-sm w-20"
                      value={posMap[pid] ?? ''}
                      onChange={e => setPosMap(m => ({ ...m, [pid]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={savePositions} disabled={savingPos} className="btn-primary text-sm py-1.5">
                  {savingPos ? 'Saving…' : 'Save positions'}
                </button>
                <button onClick={() => setEditingPos(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {[...participants]
                .sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99))
                .map(p => (
                  <div key={p.player_id} className="flex items-center gap-3 text-sm py-1">
                    <span className="text-slate-600 w-5 text-right font-mono text-xs">
                      {p.final_position ?? '—'}
                    </span>
                    <span className={p.final_position === 1 ? 'text-pool-accent font-semibold' : 'text-slate-400'}>
                      {p.player?.name}
                    </span>
                    {p.final_position === 1 && <span>🏆</span>}
                  </div>
                ))}
              {participants.every(p => p.final_position === null) && (
                <p className="text-slate-600 text-xs">No positions set yet — click Edit to assign them.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
