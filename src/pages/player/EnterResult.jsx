import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { nowNZLocal, nzLocalToISO } from '../../lib/dateUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function computeTbPairs(playerIds, matches, activatedAt) {
  const pairs = []
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i], p2 = playerIds[j]
      const tbMatch = matches
        .filter(m =>
          ((m.player1_id === p1 && m.player2_id === p2) || (m.player1_id === p2 && m.player2_id === p1)) &&
          (!activatedAt || new Date(m.played_at) >= new Date(activatedAt))
        )
        .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))[0] ?? null
      pairs.push({ p1, p2, match: tbMatch })
    }
  }
  return pairs
}

async function autoFillRRPositions(pIds, matches, tournamentId) {
  const standings = computeStandings(pIds, matches)
  const sorted = [...pIds].sort((a, b) => {
    const wa = standings[a]?.wins ?? 0, wb = standings[b]?.wins ?? 0
    if (wb !== wa) return wb - wa
    return (standings[a]?.losses ?? 0) - (standings[b]?.losses ?? 0)
  })
  const positions = Object.fromEntries(sorted.map((pid, i) => [pid, i + 1]))
  await supabase.rpc('complete_tournament', {
    p_tournament_id: tournamentId,
    p_positions: positions,
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnterResult() {
  const { linkedPlayerId } = useAuth()
  const navigate = useNavigate()

  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [player1Id, setPlayer1Id] = useState(linkedPlayerId ?? '')
  const [player2Id, setPlayer2Id] = useState('')
  const [playedAt, setPlayedAt] = useState(nowNZLocal())
  const [tournamentId, setTournamentId] = useState('')
  const [games, setGames] = useState([null, null, null])

  const [tournamentData, setTournamentData] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [selectedMatchup, setSelectedMatchup] = useState(null)
  const [activatingTiebreaker, setActivatingTiebreaker] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('id, name').eq('active', true).order('name'),
      supabase.from('tournaments').select('id, name, format').eq('completed', false).order('date', { ascending: false }).limit(20),
    ]).then(([{ data: p }, { data: t }]) => {
      setPlayers(p ?? [])
      setTournaments(t ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!tournamentId) {
      setTournamentData(null)
      setSelectedMatchup(null)
      setPlayer1Id(linkedPlayerId ?? '')
      setPlayer2Id('')
      setGames([null, null, null])
      return
    }
    setLoadingSchedule(true)
    setSelectedMatchup(null)
    setPlayer1Id('')
    setPlayer2Id('')
    setGames([null, null, null])
    const format = tournaments.find(t => t.id === tournamentId)?.format ?? 'round_robin'
    Promise.all([
      supabase.from('tournament_participants')
        .select('player_id, player:player_id(id, name)')
        .eq('tournament_id', tournamentId),
      supabase.from('matches')
        .select('id, player1_id, player2_id, winner_id, played_at')
        .eq('tournament_id', tournamentId)
        .not('winner_id', 'is', null),
      supabase.from('tournament_rounds')
        .select('id, round_number, position, player1_id, player2_id, winner_id, is_bye')
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('position'),
      supabase.from('tournaments')
        .select('tiebreaker_players, tiebreaker_activated_at')
        .eq('id', tournamentId)
        .maybeSingle(),
    ]).then(([{ data: parts }, { data: matches }, { data: rounds }, { data: tb }]) => {
      setTournamentData({
        format,
        participants: parts ?? [],
        matches: matches ?? [],
        rounds: rounds ?? [],
        tiebreakerPlayers: tb?.tiebreaker_players ?? null,
        tiebreakerActivatedAt: tb?.tiebreaker_activated_at ?? null,
      })
      setLoadingSchedule(false)
    })
  }, [tournamentId])

  // Schedule pairs for display
  const schedulePairs = (() => {
    if (!tournamentData) return []
    const { format, participants, matches, rounds, tiebreakerPlayers, tiebreakerActivatedAt } = tournamentData
    const pIds = participants.map(p => p.player_id)
    if (format === 'round_robin') {
      const pairs = []
      for (let i = 0; i < pIds.length; i++) {
        for (let j = i + 1; j < pIds.length; j++) {
          const p1 = pIds[i], p2 = pIds[j]
          const done = !!(matches.find(m =>
            (m.player1_id === p1 && m.player2_id === p2) ||
            (m.player1_id === p2 && m.player2_id === p1)
          ))
          pairs.push({ p1, p2, done })
        }
      }
      if (tiebreakerPlayers?.length >= 2) {
        const tbPairs = computeTbPairs(tiebreakerPlayers, matches, tiebreakerActivatedAt)
        for (const { p1, p2, match } of tbPairs) {
          if (!match?.winner_id) pairs.push({ p1, p2, done: false, isTiebreaker: true })
        }
      }
      return pairs
    } else {
      return rounds
        .filter(r => r.player1_id && r.player2_id && !r.winner_id && !r.is_bye)
        .map(r => ({ p1: r.player1_id, p2: r.player2_id, done: false, roundRow: r }))
    }
  })()

  // Detect if a tiebreaker can be activated (all RR pairs played, top players tied, none active)
  const rrTieInfo = (() => {
    if (!tournamentData || tournamentData.format !== 'round_robin') return null
    if (tournamentData.tiebreakerPlayers?.length >= 2) return null
    const { participants, matches } = tournamentData
    const pIds = participants.map(p => p.player_id)
    if (pIds.length < 2) return null
    for (let i = 0; i < pIds.length; i++) {
      for (let j = i + 1; j < pIds.length; j++) {
        const p1 = pIds[i], p2 = pIds[j]
        if (!matches.find(m =>
          (m.player1_id === p1 && m.player2_id === p2) ||
          (m.player1_id === p2 && m.player2_id === p1)
        )) return null
      }
    }
    const standings = computeStandings(pIds, matches)
    const maxW = Math.max(...pIds.map(pid => standings[pid]?.wins ?? 0))
    const tiedGroup = pIds.filter(pid => (standings[pid]?.wins ?? 0) === maxW)
    return tiedGroup.length >= 2 ? { tiedGroup } : null
  })()

  const handleActivateTiebreaker = async () => {
    if (!rrTieInfo) return
    setActivatingTiebreaker(true)
    const d = new Date()
    d.setSeconds(0, 0)
    const now = d.toISOString()
    const { error: tbErr } = await supabase.rpc('activate_tournament_tiebreaker', {
      p_tournament_id: tournamentId,
      p_player_ids: rrTieInfo.tiedGroup,
    })
    if (!tbErr) {
      setTournamentData(prev => ({
        ...prev,
        tiebreakerPlayers: rrTieInfo.tiedGroup,
        tiebreakerActivatedAt: now,
      }))
    }
    setActivatingTiebreaker(false)
  }

  const nameOf = pid => {
    if (tournamentData) {
      const p = tournamentData.participants.find(p => p.player_id === pid)
      if (p?.player?.name) return p.player.name
    }
    return players.find(p => p.id === pid)?.name ?? ''
  }

  const selectMatchup = (p1, p2) => {
    setSelectedMatchup({ p1, p2 })
    setPlayer1Id(p1)
    setPlayer2Id(p2)
    setGames([null, null, null])
  }

  const setGame = (index, winnerId) => {
    setGames(prev => prev.map((g, i) => i === index ? winnerId : g))
  }

  const deriveWinner = () => {
    const p1Wins = games.filter(g => g === player1Id).length
    const p2Wins = games.filter(g => g === player2Id).length
    if (p1Wins >= 2) return player1Id
    if (p2Wins >= 2) return player2Id
    return null
  }

  const gamesToShow = () => {
    const p1Wins = games.filter(g => g === player1Id).length
    const p2Wins = games.filter(g => g === player2Id).length
    if (p1Wins >= 2 || p2Wins >= 2) return games.findIndex((g, i) => {
      const p1 = games.slice(0, i + 1).filter(x => x === player1Id).length
      const p2 = games.slice(0, i + 1).filter(x => x === player2Id).length
      return p1 >= 2 || p2 >= 2
    }) + 1
    return 3
  }

  const isValid = () => {
    if (!player1Id || !player2Id || player1Id === player2Id) return false
    return deriveWinner() !== null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid()) return
    setSubmitting(true)
    setError('')

    const winnerId = deriveWinner()
    const visibleGames = gamesToShow()

    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        format: 'best_of_3',
        winner_id: winnerId,
        played_at: nzLocalToISO(playedAt),
        tournament_id: tournamentId || null,
      })
      .select('id')
      .single()

    if (matchErr) { setError(matchErr.message); setSubmitting(false); return }

    const gameRows = games.slice(0, visibleGames)
      .filter(Boolean)
      .map((wId, i) => ({ match_id: match.id, game_number: i + 1, winner_id: wId }))

    if (gameRows.length) {
      const { error: gamesErr } = await supabase.from('games').insert(gameRows)
      if (gamesErr) { setError(gamesErr.message); setSubmitting(false); return }
    }

    if (tournamentId) {
      if (tournamentData?.format !== 'round_robin') {
        // ── Bracket: advance winner + check for final ─────────────────────────
        const round = selectedMatchup?.roundRow
          ?? tournamentData?.rounds?.find(r =>
            (r.player1_id === player1Id && r.player2_id === player2Id) ||
            (r.player1_id === player2Id && r.player2_id === player1Id)
          )
        if (round) {
          await supabase.rpc('advance_bracket_round', {
            p_tournament_id: tournamentId,
            p_round_id: round.id,
            p_winner_id: winnerId,
            p_round_number: round.round_number,
            p_position: round.position,
          })

          const rounds = tournamentData?.rounds ?? []
          const maxRnd = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) : 0
          if (round.round_number === maxRnd && round.position === 1) {
            const loser = round.player1_id === winnerId ? round.player2_id : round.player1_id
            const posMap = {}
            if (winnerId) posMap[winnerId] = 1
            if (loser) posMap[loser] = 2
            let pos = 3
            for (let r = maxRnd - 1; r >= 1; r--) {
              for (const br of rounds.filter(b => b.round_number === r && b.winner_id)) {
                const bLoser = br.winner_id === br.player1_id ? br.player2_id : br.player1_id
                if (bLoser && !posMap[bLoser]) posMap[bLoser] = pos++
              }
            }
            const pIds = tournamentData.participants.map(p => p.player_id)
            for (const pid of pIds) {
              if (!posMap[pid]) posMap[pid] = pos++
            }
            await supabase.rpc('complete_tournament', {
              p_tournament_id: tournamentId,
              p_positions: posMap,
            })
          }
        }
      } else {
        // ── Round robin: check for completion ─────────────────────────────────
        const { data: freshMatches } = await supabase
          .from('matches')
          .select('player1_id, player2_id, winner_id, played_at')
          .eq('tournament_id', tournamentId)
          .not('winner_id', 'is', null)

        const pIds = tournamentData.participants.map(p => p.player_id)
        let allPairsPlayed = pIds.length >= 2
        for (let i = 0; i < pIds.length && allPairsPlayed; i++) {
          for (let j = i + 1; j < pIds.length && allPairsPlayed; j++) {
            const p1 = pIds[i], p2 = pIds[j]
            if (!(freshMatches ?? []).find(m =>
              (m.player1_id === p1 && m.player2_id === p2) ||
              (m.player1_id === p2 && m.player2_id === p1)
            )) allPairsPlayed = false
          }
        }

        if (allPairsPlayed) {
          const { data: tb } = await supabase.from('tournaments')
            .select('tiebreaker_players, tiebreaker_activated_at')
            .eq('id', tournamentId).maybeSingle()

          const tbPlayers = tb?.tiebreaker_players
          if (tbPlayers?.length >= 2) {
            const freshTbPairs = computeTbPairs(tbPlayers, freshMatches ?? [], tb.tiebreaker_activated_at)
            const allTbDone = freshTbPairs.length > 0 && freshTbPairs.every(p => p.match?.winner_id)
            if (allTbDone) {
              const tbStats = {}
              for (const pid of tbPlayers) tbStats[pid] = 0
              for (const { match } of freshTbPairs) {
                if (match?.winner_id && tbStats[match.winner_id] !== undefined) tbStats[match.winner_id]++
              }
              const maxTbW = Math.max(...tbPlayers.map(pid => tbStats[pid]))
              const stillTied = tbPlayers.filter(pid => tbStats[pid] === maxTbW)
              if (stillTied.length >= 2) {
                await supabase.rpc('activate_tournament_tiebreaker', {
                  p_tournament_id: tournamentId,
                  p_player_ids: stillTied,
                })
              } else {
                await autoFillRRPositions(pIds, freshMatches ?? [], tournamentId)
              }
            }
          } else {
            const standings = computeStandings(pIds, freshMatches ?? [])
            const maxW = Math.max(...pIds.map(pid => standings[pid]?.wins ?? 0))
            const tiedGroup = pIds.filter(pid => (standings[pid]?.wins ?? 0) === maxW)
            if (tiedGroup.length < 2) {
              await autoFillRRPositions(pIds, freshMatches ?? [], tournamentId)
            }
          }
        }
      }
    }

    navigate('/')
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="section-header">New Result</p>
        <h1 className="page-title">Enter Match</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Match Details */}
        <div className="card p-5 space-y-4">
          <p className="section-header mb-0">Match Details</p>
          <div>
            <label className="label">Date &amp; time</label>
            <input
              type="datetime-local"
              className="input"
              value={playedAt}
              onChange={e => setPlayedAt(e.target.value)}
              required
            />
          </div>
          {tournaments.length > 0 && (
            <div>
              <label className="label">Tournament (optional)</label>
              <select className="select" value={tournamentId} onChange={e => setTournamentId(e.target.value)}>
                <option value="">None</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tournament schedule */}
        {tournamentId && (
          <div className="card p-5 space-y-3">
            <p className="section-header mb-0">Select Matchup</p>
            {loadingSchedule ? (
              <p className="text-slate-600 text-sm">Loading schedule…</p>
            ) : (
              <>
                {schedulePairs.length === 0 && !rrTieInfo && (
                  <p className="text-slate-600 text-sm">No pending matches for this tournament.</p>
                )}
                {schedulePairs.length > 0 && (
                  <div className="divide-y divide-pool-border/40">
                    {schedulePairs.map(({ p1, p2, done, isTiebreaker }) => {
                      const isSelected = selectedMatchup?.p1 === p1 && selectedMatchup?.p2 === p2
                      return (
                        <div
                          key={`${isTiebreaker ? 'tb' : 'rr'}-${p1}-${p2}`}
                          onClick={() => !done && selectMatchup(p1, p2)}
                          className={`flex items-center justify-between py-2.5 ${
                            done ? 'opacity-40' : 'cursor-pointer group'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm">
                            {isTiebreaker && (
                              <span className="text-amber-500 text-xs font-medium shrink-0">TB</span>
                            )}
                            <span className={
                              isSelected ? 'text-pool-accent font-semibold'
                              : done ? 'text-slate-500'
                              : 'text-slate-300 group-hover:text-slate-100 transition-colors'
                            }>
                              {nameOf(p1)}
                            </span>
                            <span className="text-slate-600 text-xs font-mono">vs</span>
                            <span className={
                              isSelected ? 'text-pool-accent font-semibold'
                              : done ? 'text-slate-500'
                              : 'text-slate-300 group-hover:text-slate-100 transition-colors'
                            }>
                              {nameOf(p2)}
                            </span>
                          </div>
                          <span className={`text-xs shrink-0 ${
                            done ? 'text-slate-600'
                            : isSelected ? 'text-pool-accent'
                            : 'text-slate-700 group-hover:text-slate-500 transition-colors'
                          }`}>
                            {done ? 'done' : isSelected ? '✓ selected' : 'select →'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Activate tiebreaker — shown when all RR pairs done and leaders are tied */}
                {rrTieInfo && (
                  <div className="mt-1 p-3 rounded-lg bg-amber-950/20 border border-amber-900/50 space-y-2">
                    <p className="text-amber-500 text-sm font-medium">
                      Tiebreaker required — {rrTieInfo.tiedGroup.map(pid => nameOf(pid)).join(' & ')} are tied
                    </p>
                    <button
                      type="button"
                      onClick={handleActivateTiebreaker}
                      disabled={activatingTiebreaker}
                      className="btn-primary text-sm py-1.5"
                    >
                      {activatingTiebreaker ? 'Activating…' : 'Activate Tiebreaker'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Manual player selection — only when no tournament */}
        {!tournamentId && (
          <div className="card p-5 space-y-4">
            <p className="section-header mb-0">Players</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Player 1</label>
                <select className="select" value={player1Id} onChange={e => setPlayer1Id(e.target.value)} required>
                  <option value="">Select…</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id} disabled={p.id === player2Id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Player 2</label>
                <select className="select" value={player2Id} onChange={e => setPlayer2Id(e.target.value)} required>
                  <option value="">Select…</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id} disabled={p.id === player1Id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Game results */}
        {player1Id && player2Id && player1Id !== player2Id && (
          <div className="card p-5 space-y-3">
            <p className="section-header mb-0">Game Results</p>
            <div className="space-y-2">
              {[0, 1, 2].slice(0, gamesToShow()).map(i => (
                <div key={i}>
                  <p className="text-xs text-slate-600 mb-1.5">Game {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[player1Id, player2Id].map(pid => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setGame(i, pid)}
                        className={`py-2.5 rounded-lg font-medium text-sm transition-all border ${
                          games[i] === pid
                            ? 'bg-pool-accent-muted border-pool-accent text-pool-accent'
                            : 'bg-pool-surface border-pool-border text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {nameOf(pid)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {deriveWinner() && (
                <div className="mt-3 px-3 py-2.5 bg-green-950/30 border border-green-900/40 rounded-lg text-sm text-pool-win font-semibold">
                  {nameOf(deriveWinner())} wins the match
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/')} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={!isValid() || submitting}>
            {submitting ? 'Saving…' : 'Save Result'}
          </button>
        </div>
      </form>
    </div>
  )
}
