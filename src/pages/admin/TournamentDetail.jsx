import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { nowNZLocal, nzLocalToISO, formatDateShort } from '../../lib/dateUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import BracketView from '../../components/tournament/BracketView'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveWinner(games, p1id, p2id) {
  let w1 = 0, w2 = 0
  for (const g of games) {
    if (g === p1id) w1++; else if (g === p2id) w2++
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

// Standard playoff bracket seeding: #1 vs #N, #4 vs #5, #2 vs #7, #3 vs #6, etc.
function playoffMatchups(bracketSize) {
  if (bracketSize === 2) return [[1, 2]]
  const half = playoffMatchups(bracketSize / 2)
  const result = []
  for (const [a, b] of half) {
    result.push([a, bracketSize + 1 - a])
    result.push([b, bracketSize + 1 - b])
  }
  return result
}

// Build seeded player list from overall match history
async function buildSeeds(participantIds, method) {
  if (method === 'random') {
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5)
    return shuffled.map((pid, i) => ({ player_id: pid, seed: i + 1 }))
  }
  const { data: matches } = await supabase
    .from('matches')
    .select('player1_id, player2_id, winner_id')
    .not('winner_id', 'is', null)
  const stats = {}
  for (const pid of participantIds) stats[pid] = { wins: 0, total: 0 }
  for (const m of (matches ?? [])) {
    if (stats[m.player1_id] !== undefined) stats[m.player1_id].total++
    if (stats[m.player2_id] !== undefined) stats[m.player2_id].total++
    if (m.winner_id && stats[m.winner_id] !== undefined) stats[m.winner_id].wins++
  }
  const sorted = [...participantIds].sort((a, b) => {
    const ra = stats[a].total ? stats[a].wins / stats[a].total : 0
    const rb = stats[b].total ? stats[b].wins / stats[b].total : 0
    return rb - ra
  })
  return sorted.map((pid, i) => ({ player_id: pid, seed: i + 1 }))
}

// ─── Record match modal ───────────────────────────────────────────────────────

function RecordModal({ p1, p2, nameOf, onSave, onClose }) {
  const [games, setGames] = useState(['', '', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setGame = (i, v) => { const g = [...games]; g[i] = v; setGames(g) }
  const winner = deriveWinner(games, p1, p2)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const err = await onSave(games, winner)
    if (err) { setError(err); setSaving(false) } else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-pool-card border border-pool-border rounded-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-100">{nameOf(p1)} vs {nameOf(p2)}</h2>

        <div>
          <label className="label">Game results</label>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-slate-500 text-xs w-12 shrink-0">Game {i + 1}</span>
                <select className="select text-sm" value={games[i]} onChange={e => setGame(i, e.target.value)}>
                  <option value="">— not played —</option>
                  <option value={p1}>{nameOf(p1)}</option>
                  <option value={p2}>{nameOf(p2)}</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {winner && (
          <p className="text-sm text-slate-400">Winner: <span className="text-pool-accent font-semibold">{nameOf(winner)}</span></p>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !winner} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save Result'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminTournamentDetail() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const [participants, setParticipants] = useState([])
  const [tMatches, setTMatches] = useState([])       // matches table rows
  const [bracketRounds, setBracketRounds] = useState([]) // tournament_rounds rows
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Participants editor
  const [editingParts, setEditingParts] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [savingParts, setSavingParts] = useState(false)

  // Round-robin inline record
  const [rrModal, setRrModal] = useState(null) // { p1, p2 }

  // Bracket modal
  const [bracketModal, setBracketModal] = useState(null) // tournament_round row

  // Bracket generation
  const [generating, setGenerating] = useState(false)

  // Final positions
  const [editingPos, setEditingPos] = useState(false)
  const [posMap, setPosMap] = useState({})
  const [savingPos, setSavingPos] = useState(false)

  const load = async () => {
    const [{ data: t }, { data: p }, { data: parts }, { data: m }, { data: br }] = await Promise.all([
      supabase.from('tournaments').select('id, name, date, format, seeding').eq('id', id).single(),
      supabase.from('players').select('id, name').eq('active', true).order('name'),
      supabase
        .from('tournament_participants')
        .select('player_id, final_position, player:player_id(id, name)')
        .eq('tournament_id', id),
      supabase
        .from('matches')
        .select(`
          id, played_at, winner_id, player1_id, player2_id,
          player1:player1_id(id, name), player2:player2_id(id, name),
          games(game_number, winner_id)
        `)
        .eq('tournament_id', id)
        .order('played_at', { ascending: false }),
      supabase
        .from('tournament_rounds')
        .select('*')
        .eq('tournament_id', id)
        .order('round_number')
        .order('position'),
    ])
    setTournament(t)
    setAllPlayers(p ?? [])
    setParticipants(parts ?? [])
    setTMatches(m ?? [])
    setBracketRounds(br ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const participantIds = participants.map(p => p.player_id)
  const nameOf = pid =>
    participants.find(p => p.player_id === pid)?.player?.name
    ?? allPlayers.find(p => p.id === pid)?.name
    ?? ''

  // ── Participants ────────────────────────────────────────────────────────────

  const saveParticipants = async () => {
    setSavingParts(true)
    setError('')
    await supabase.from('tournament_participants').delete().eq('tournament_id', id)
    if (selectedIds.size) {
      const { error: e } = await supabase
        .from('tournament_participants')
        .insert([...selectedIds].map(pid => ({ tournament_id: id, player_id: pid })))
      if (e) { setError(e.message); setSavingParts(false); return }
    }
    setSavingParts(false)
    setEditingParts(false)
    load()
  }

  // ── Round-robin match recording ─────────────────────────────────────────────

  const saveRRMatch = async (games, winner) => {
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .insert({
        player1_id: rrModal.p1,
        player2_id: rrModal.p2,
        played_at: nzLocalToISO(nowNZLocal()),
        format: 'best_of_3',
        winner_id: winner,
        tournament_id: id,
      })
      .select('id')
      .single()
    if (mErr) return mErr.message
    const gameRows = games
      .map((w, i) => w ? { match_id: match.id, game_number: i + 1, winner_id: w } : null)
      .filter(Boolean)
    if (gameRows.length) await supabase.from('games').insert(gameRows)
    load()
    return null
  }

  const removeMatch = async matchId => {
    if (!confirm('Remove this match from the tournament? The result stays in overall history.')) return
    await supabase.from('matches').update({ tournament_id: null }).eq('id', matchId)
    load()
  }

  // ── Bracket generation ──────────────────────────────────────────────────────

  const generateBracket = async () => {
    setGenerating(true)
    setError('')
    const n = participantIds.length
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
    const numRounds = Math.log2(bracketSize)
    const seeding = tournament.seeding ?? 'ranked_playoff'

    const seeds = await buildSeeds(participantIds, seeding)
    // Pad to bracket size with byes
    while (seeds.length < bracketSize) seeds.push({ player_id: null, seed: seeds.length + 1 })

    // Build round 1 matchups
    let pairs
    if (seeding === 'ranked_similar') {
      // 1v2, 3v4, 5v6...
      pairs = []
      for (let i = 0; i < bracketSize; i += 2) pairs.push([i + 1, i + 2])
    } else {
      // Playoff: 1vN, 4v(N-3), 2v(N-1), 3v(N-2)...
      pairs = playoffMatchups(bracketSize)
    }

    const rows = []
    pairs.forEach(([s1, s2], pos) => {
      const p1 = seeds.find(s => s.seed === s1)?.player_id ?? null
      const p2 = seeds.find(s => s.seed === s2)?.player_id ?? null
      const isBye = !p2
      rows.push({
        tournament_id: id,
        round_number: 1,
        position: pos + 1,
        player1_id: p1,
        player2_id: p2,
        winner_id: isBye ? p1 : null,
        is_bye: isBye,
      })
    })

    // Empty slots for future rounds
    for (let r = 2; r <= numRounds; r++) {
      const count = bracketSize / Math.pow(2, r)
      for (let pos = 1; pos <= count; pos++) {
        rows.push({ tournament_id: id, round_number: r, position: pos,
          player1_id: null, player2_id: null, winner_id: null, is_bye: false })
      }
    }

    const { error: e } = await supabase.from('tournament_rounds').insert(rows)
    if (e) { setError(e.message); setGenerating(false); return }

    // Auto-advance bye winners
    for (const row of rows.filter(r => r.is_bye && r.winner_id)) {
      await advanceWinnerInDB(row.round_number, row.position, row.winner_id)
    }

    setGenerating(false)
    load()
  }

  const resetBracket = async () => {
    if (!confirm('Reset the bracket? All bracket structure will be cleared. Match records in overall history are kept.')) return
    // Unlink matches from tournament (keep in history)
    await supabase.from('matches').update({ tournament_id: null })
      .eq('tournament_id', id)
    await supabase.from('tournament_rounds').delete().eq('tournament_id', id)
    load()
  }

  // ── Bracket result recording ────────────────────────────────────────────────

  const saveBracketMatch = async (games, winner) => {
    const round = bracketModal
    // Create match record
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .insert({
        player1_id: round.player1_id,
        player2_id: round.player2_id,
        played_at: nzLocalToISO(nowNZLocal()),
        format: 'best_of_3',
        winner_id: winner,
        tournament_id: id,
      })
      .select('id')
      .single()
    if (mErr) return mErr.message

    const gameRows = games
      .map((w, i) => w ? { match_id: match.id, game_number: i + 1, winner_id: w } : null)
      .filter(Boolean)
    if (gameRows.length) await supabase.from('games').insert(gameRows)

    // Update this round entry
    await supabase.from('tournament_rounds').update({ winner_id: winner }).eq('id', round.id)

    // Advance winner to next round
    await advanceWinnerInDB(round.round_number, round.position, winner)

    load()
    return null
  }

  const advanceWinnerInDB = async (roundNum, position, winnerId) => {
    const nextRound = roundNum + 1
    const nextPos = Math.ceil(position / 2)
    const slot = position % 2 === 1 ? 'player1_id' : 'player2_id'
    await supabase
      .from('tournament_rounds')
      .update({ [slot]: winnerId })
      .eq('tournament_id', id)
      .eq('round_number', nextRound)
      .eq('position', nextPos)
  }

  // ── Final positions ─────────────────────────────────────────────────────────

  const autoFillPositions = () => {
    const standings = computeStandings(participantIds, tMatches)
    const sorted = [...participantIds].sort((a, b) => {
      const wa = standings[a]?.wins ?? 0, wb = standings[b]?.wins ?? 0
      if (wb !== wa) return wb - wa
      return (standings[a]?.losses ?? 0) - (standings[b]?.losses ?? 0)
    })
    setPosMap(Object.fromEntries(sorted.map((pid, i) => [pid, String(i + 1)])))
  }

  const autoFillFromBracket = () => {
    const maxRound = Math.max(...bracketRounds.map(r => r.round_number))
    const final = bracketRounds.find(r => r.round_number === maxRound && r.position === 1)
    if (!final) return
    const map = {}
    if (final.winner_id) map[final.winner_id] = '1'
    const runner = final.player1_id === final.winner_id ? final.player2_id : final.player1_id
    if (runner) map[runner] = '2'
    // Seed remaining from semi-final losers outward
    let pos = 3
    for (let r = maxRound - 1; r >= 1; r--) {
      const roundMatches = bracketRounds.filter(b => b.round_number === r && b.winner_id)
      for (const m of roundMatches) {
        const loser = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
        if (loser && !map[loser]) { map[loser] = String(pos++); }
      }
    }
    for (const pid of participantIds) { if (!map[pid]) map[pid] = '' }
    setPosMap(map)
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />
  if (!tournament) return <div className="text-slate-500 p-8">Tournament not found.</div>

  const isBracket = tournament.format !== 'round_robin'

  // Build bracket rounds as arrays-of-arrays for BracketView
  const roundGroups = []
  if (bracketRounds.length) {
    const maxR = Math.max(...bracketRounds.map(r => r.round_number))
    for (let r = 1; r <= maxR; r++) {
      roundGroups.push(bracketRounds.filter(b => b.round_number === r))
    }
  }

  // Round-robin: compute all pairs and find completed ones
  const rrPairs = []
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      const p1 = participantIds[i], p2 = participantIds[j]
      const match = tMatches.find(m =>
        (m.player1_id === p1 && m.player2_id === p2) ||
        (m.player1_id === p2 && m.player2_id === p1)
      )
      rrPairs.push({ p1, p2, match })
    }
  }
  const rrComplete = rrPairs.filter(p => p.match?.winner_id).length
  const standings = computeStandings(participantIds, tMatches)
  const sortedByStandings = [...participantIds].sort((a, b) => {
    const wa = standings[a]?.wins ?? 0, wb = standings[b]?.wins ?? 0
    if (wb !== wa) return wb - wa
    return (standings[a]?.losses ?? 0) - (standings[b]?.losses ?? 0)
  })

  const seedingLabel = {
    ranked_playoff: 'Playoff style (#1 vs #N)',
    ranked_similar: 'Similar ranking (#1 vs #2)',
    random: 'Random draw',
  }[tournament.seeding ?? 'ranked_playoff'] ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin/tournaments" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← All tournaments
        </Link>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">{tournament.name}</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date(tournament.date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
          {' · '}
          <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
          {isBracket && seedingLabel && <span className="text-slate-600"> · {seedingLabel}</span>}
        </p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Modals */}
      {rrModal && (
        <RecordModal
          p1={rrModal.p1} p2={rrModal.p2}
          nameOf={nameOf}
          onSave={saveRRMatch}
          onClose={() => setRrModal(null)}
        />
      )}
      {bracketModal && (
        <RecordModal
          p1={bracketModal.player1_id} p2={bracketModal.player2_id}
          nameOf={nameOf}
          onSave={saveBracketMatch}
          onClose={() => setBracketModal(null)}
        />
      )}

      {/* Participants */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-header">Participants ({participants.length})</p>
          {!editingParts && (
            <button
              onClick={() => { setSelectedIds(new Set(participantIds)); setEditingParts(true) }}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
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
                    onClick={() => {
                      const next = new Set(selectedIds)
                      on ? next.delete(p.id) : next.add(p.id)
                      setSelectedIds(next)
                    }}
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

      {/* ── BRACKET FORMAT ── */}
      {isBracket && participantIds.length >= 2 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-header">
              Bracket
              {bracketRounds.length > 0 && (
                <span className="text-slate-600 font-normal ml-2 text-xs">
                  ({Math.max(...bracketRounds.map(r => r.round_number))} rounds · {Math.pow(2, Math.ceil(Math.log2(participantIds.length)))}-player draw)
                </span>
              )}
            </p>
            <div className="flex gap-3">
              {bracketRounds.length > 0 && (
                <button onClick={resetBracket} className="text-red-700 hover:text-red-500 text-xs transition-colors">
                  Reset
                </button>
              )}
              {bracketRounds.length === 0 && (
                <button
                  onClick={generateBracket}
                  disabled={generating}
                  className="btn-primary text-sm py-1.5"
                >
                  {generating ? 'Generating…' : 'Generate Bracket'}
                </button>
              )}
            </div>
          </div>

          {bracketRounds.length === 0 ? (
            <p className="text-slate-600 text-sm">
              Click "Generate Bracket" to seed {participantIds.length} players and build the draw.
            </p>
          ) : (
            <>
              <p className="text-slate-600 text-xs">Click any pending match to record the result. Winners advance automatically.</p>
              <BracketView
                rounds={roundGroups}
                nameOf={nameOf}
                onMatchClick={setBracketModal}
              />
            </>
          )}
        </div>
      )}

      {/* ── ROUND ROBIN FORMAT ── */}
      {!isBracket && (
        <>
          {/* Standings */}
          {participantIds.length > 0 && (
            <div className="card overflow-x-auto">
              <div className="px-5 pt-4 pb-2">
                <p className="section-header">
                  Standings
                  {rrPairs.length > 0 && (
                    <span className="text-slate-600 font-normal ml-2 text-xs">
                      {rrComplete}/{rrPairs.length} matches played
                    </span>
                  )}
                </p>
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

          {/* Schedule */}
          {participantIds.length >= 2 && (
            <div className="card p-5 space-y-3">
              <p className="section-header">
                Schedule
                <span className="text-slate-600 font-normal ml-2 text-xs">
                  {rrPairs.length} matchups — click any pending result to record it
                </span>
              </p>
              {rrPairs.length === 0 ? (
                <p className="text-slate-600 text-sm">Add at least 2 participants to see the schedule.</p>
              ) : (
                <div className="divide-y divide-pool-border/40">
                  {rrPairs.map(({ p1, p2, match }) => {
                    const done = !!match?.winner_id
                    const games = [...(match?.games ?? [])].sort((a, b) => a.game_number - b.game_number)
                    const s1 = games.filter(g => g.winner_id === match?.player1_id).length
                    const s2 = games.filter(g => g.winner_id === match?.player2_id).length
                    return (
                      <div
                        key={`${p1}-${p2}`}
                        className={`flex items-center justify-between py-2.5 ${!done ? 'cursor-pointer group' : ''}`}
                        onClick={() => !done && setRrModal({ p1, p2 })}
                      >
                        <div className="text-sm">
                          <span className={done && match.winner_id === p1 ? 'text-slate-100 font-semibold' : done ? 'text-slate-500' : 'text-slate-300 group-hover:text-slate-100 transition-colors'}>
                            {nameOf(p1)}
                          </span>
                          <span className="text-slate-600 mx-2 font-mono text-xs">
                            {done && games.length > 0 ? `${s1}–${s2}` : 'vs'}
                          </span>
                          <span className={done && match.winner_id === p2 ? 'text-slate-100 font-semibold' : done ? 'text-slate-500' : 'text-slate-300 group-hover:text-slate-100 transition-colors'}>
                            {nameOf(p2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {done ? (
                            <>
                              <span className="text-slate-600 text-xs">{formatDateShort(match.played_at)}</span>
                              <button
                                onClick={e => { e.stopPropagation(); removeMatch(match.id) }}
                                className="text-red-700 hover:text-red-500 text-xs transition-colors"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-700 text-xs group-hover:text-slate-500 transition-colors">
                              pending →
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Final positions */}
      {participantIds.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-header">Final Positions</p>
            {!editingPos && (
              <button
                onClick={() => {
                  setPosMap(Object.fromEntries(participants.map(p => [p.player_id, p.final_position ? String(p.final_position) : ''])))
                  setEditingPos(true)
                }}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editingPos ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                {!isBracket && tMatches.length > 0 && (
                  <button onClick={autoFillPositions} className="text-xs text-pool-accent hover:text-pool-accent-dim transition-colors">
                    Auto-fill from standings
                  </button>
                )}
                {isBracket && bracketRounds.some(r => r.winner_id) && (
                  <button onClick={autoFillFromBracket} className="text-xs text-pool-accent hover:text-pool-accent-dim transition-colors">
                    Auto-fill from bracket
                  </button>
                )}
              </div>
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
                    <span className="text-slate-600 w-5 text-right font-mono text-xs">{p.final_position ?? '—'}</span>
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
