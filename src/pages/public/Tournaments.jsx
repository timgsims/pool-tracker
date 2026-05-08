import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateShort } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import BracketView from '../../components/tournament/BracketView'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import Avatar from '../../components/ui/Avatar'

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

function computeTournamentPairs(inputMatches) {
  const pairMap = {}
  for (const m of inputMatches) {
    if (!m.winner_id) continue
    const [a, b] = [m.player1_id, m.player2_id].sort()
    const key = `${a}-${b}`
    if (!pairMap[key]) pairMap[key] = { a, b, aWins: 0, bWins: 0, matches: [] }
    if (m.winner_id === a) pairMap[key].aWins++
    else pairMap[key].bWins++
    pairMap[key].matches.push(m)
  }
  return Object.values(pairMap)
}

function gameSeq(games, playerId) {
  if (!games?.length) return null
  return [...games]
    .sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
    .map(g => g.winner_id === playerId ? 'W' : 'L')
    .join('-')
}

function getBracketRoundName(roundIdx, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIdx
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Final'
  if (fromEnd === 2) return 'Quarter-Final'
  return `Round ${roundIdx + 1}`
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [matchesByTournament, setMatchesByTournament] = useState({})
  const [roundsByTournament, setRoundsByTournament] = useState({})
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [seasonStart, setSeasonStart] = useState('')
  const [seasonEnd, setSeasonEnd] = useState('')
  const [expandedMatches, setExpandedMatches] = useState(new Set())
  const [expandedPairs, setExpandedPairs] = useState({})
  const [bracketPopup, setBracketPopup] = useState(null)

  useEffect(() => {
    supabase.from('seasons').select('start_date, end_date').eq('is_active', true).maybeSingle()
      .then(({ data }) => {
        setSeasonStart(data?.start_date ?? '')
        setSeasonEnd(data?.end_date ?? '')
      })
    Promise.all([
      supabase
        .from('matches')
        .select('id, tournament_id, player1_id, player2_id, winner_id, played_at, created_at, format, games(game_number, winner_id)')
        .not('tournament_id', 'is', null)
        .order('played_at', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('tournament_rounds')
        .select('*')
        .order('round_number')
        .order('position'),
    ]).then(([{ data: m }, { data: r }]) => {
      const byId = {}
      for (const match of (m ?? [])) {
        if (!byId[match.tournament_id]) byId[match.tournament_id] = []
        byId[match.tournament_id].push(match)
      }
      setMatchesByTournament(byId)

      const roundsById = {}
      for (const row of (r ?? [])) {
        if (!roundsById[row.tournament_id]) roundsById[row.tournament_id] = []
        roundsById[row.tournament_id].push(row)
      }
      setRoundsByTournament(roundsById)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    let q = supabase
      .from('tournaments')
      .select(`
        id, name, date, created_at, tiebreaker_activated_at, format, seeding,
        tournament_participants(
          player_id, final_position,
          player:player_id(id, name, avatar_url)
        )
      `)
      .order('date', { ascending: false })
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    q.then(({ data }) => {
      setTournaments(data ?? [])
      setLoading(false)
    })
  }, [from, to])

  if (loading) return <LoadingSpinner />

  // Hoist name/avatar maps so they're available for the bracket popup modal
  const allPlayers = Object.values(
    tournaments.flatMap(t => t.tournament_participants ?? [])
      .filter(p => p.player?.id)
      .reduce((acc, p) => { acc[p.player.id] = p.player; return acc }, {})
  )
  const displayNameMap = buildDisplayNames(allPlayers)
  const sn = pid => displayNameMap[pid] ?? ''
  const globalAvatarMap = Object.fromEntries(allPlayers.map(p => [p.id, p.avatar_url ?? null]))

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">History</p>
        <h1 className="page-title">Tournaments</h1>
      </div>

      <DateRangeFilter
        onApply={(f, t) => { setFrom(f); setTo(t) }}
        seasonStart={seasonStart}
        seasonEnd={seasonEnd}
      />

      {tournaments.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No tournaments yet"
            message="Tournament results will appear here once added by the admin."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {[...tournaments].sort((a, b) => {
            const isComplete = t => t.tournament_participants?.some(p => p.final_position === 1)
            const latestKey = t => {
              const matches = matchesByTournament[t.id] ?? []
              const candidates = [
                ...matches.map(m => m.played_at),
                t.tiebreaker_activated_at,
                t.created_at,
              ].filter(Boolean)
              return candidates.sort().reverse()[0] ?? ''
            }
            const ac = isComplete(a) ? 1 : 0
            const bc = isComplete(b) ? 1 : 0
            if (ac !== bc) return ac - bc
            return latestKey(b).localeCompare(latestKey(a))
          }).map(t => {
            const parts = [...(t.tournament_participants ?? [])]
            const tMatches = matchesByTournament[t.id] ?? []
            const tRounds = roundsByTournament[t.id] ?? []
            const isBracket = t.format !== 'round_robin'
            const hasPositions = parts.some(p => p.final_position !== null)
            const winner = parts.find(p => p.final_position === 1)
            const participantIds = parts.map(p => p.player_id)
            const nameOf = pid => sn(pid) || (parts.find(p => p.player_id === pid)?.player?.name ?? '')

            const roundGroups = []
            if (isBracket && tRounds.length) {
              const maxR = Math.max(...tRounds.map(r => r.round_number))
              for (let r = 1; r <= maxR; r++) {
                roundGroups.push(tRounds.filter(b => b.round_number === r))
              }
            }

            const standings = computeStandings(participantIds, tMatches)
            const sortedParts = hasPositions
              ? [...parts].sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99))
              : [...parts].sort((a, b) => {
                  const wa = standings[a.player_id]?.wins ?? 0
                  const wb = standings[b.player_id]?.wins ?? 0
                  if (wb !== wa) return wb - wa
                  return (standings[a.player_id]?.losses ?? 0) - (standings[b.player_id]?.losses ?? 0)
                })

            const tournamentPairs = !isBracket && tMatches.length > 0
              ? computeTournamentPairs(tMatches)
                  .map(pair => {
                    const aName = nameOf(pair.a)
                    const bName = nameOf(pair.b)
                    const leftFirst = aName.localeCompare(bName) <= 0
                    return {
                      ...pair,
                      left: leftFirst ? pair.a : pair.b,
                      right: leftFirst ? pair.b : pair.a,
                      leftW: leftFirst ? pair.aWins : pair.bWins,
                      rightW: leftFirst ? pair.bWins : pair.aWins,
                    }
                  })
                  .sort((a, b) => nameOf(a.left).localeCompare(nameOf(b.left)))
              : []

            const matchesExpanded = expandedMatches.has(t.id)
            const expandedPairKey = expandedPairs[t.id] ?? null

            return (
              <div key={t.id} className="card p-5">
                {/* Header */}
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-slate-100 text-lg leading-tight">{t.name}</h2>
                    {winner ? (
                      <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/40">
                        <span className="text-amber-400 text-sm">🏆</span>
                        <span className="text-amber-300 text-sm font-semibold">{sn(winner.player_id)}</span>
                      </div>
                    ) : (
                      <span className="badge-gray shrink-0">In Progress</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                    <span>
                      {new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                      {' · '}
                      {isBracket ? 'Single Elimination' : 'Round Robin'}
                    </span>
                    <span>
                      {parts.length} players
                      {tMatches.length > 0 && ` · ${tMatches.length} matches`}
                    </span>
                  </div>
                </div>

                {/* Bracket view — completed matches are clickable to reveal result */}
                {isBracket && roundGroups.length > 0 && (
                  <div className="border-t border-pool-border/50 pt-4">
                    <p className="section-header mb-1">Bracket</p>
                    <p className="text-slate-600 text-xs mb-3">Tap a completed match to see the result</p>
                    <BracketView
                      rounds={roundGroups}
                      nameOf={nameOf}
                      readOnly
                      onViewMatch={(bracketMatch) => {
                        const actualMatch = tMatches.find(m =>
                          (m.player1_id === bracketMatch.player1_id && m.player2_id === bracketMatch.player2_id) ||
                          (m.player1_id === bracketMatch.player2_id && m.player2_id === bracketMatch.player1_id)
                        )
                        setBracketPopup({
                          match: bracketMatch,
                          actualMatch,
                          tournamentName: t.name,
                          totalRounds: roundGroups.length,
                        })
                      }}
                    />
                  </div>
                )}

                {/* Round robin standings */}
                {!isBracket && sortedParts.length > 0 && (
                  <div className="border-t border-pool-border/50 pt-3">
                    <p className="section-header mb-2">
                      {hasPositions ? 'Final standings' : 'Current standings'}
                    </p>
                    {tMatches.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <colgroup>
                            <col className="w-6" />
                            <col />
                            <col className="w-10" />
                            <col className="w-10" />
                            <col className="w-14" />
                          </colgroup>
                          <thead>
                            <tr className="text-slate-600 text-xs">
                              <td className="pb-1 pr-2">#</td>
                              <td className="pb-1">Player</td>
                              <td className="pb-1 text-center">W</td>
                              <td className="pb-1 text-center">L</td>
                              <td className="pb-1 text-right">Win%</td>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedParts.map((p, i) => {
                              const s = standings[p.player_id]
                              const total = (s?.wins ?? 0) + (s?.losses ?? 0)
                              const pos = hasPositions ? (p.final_position ?? i + 1) : i + 1
                              return (
                                <tr key={p.player_id}>
                                  <td className="py-0.5 pr-2 text-slate-600 font-mono text-xs">{pos}</td>
                                  <td className={`py-0.5 ${pos === 1 ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
                                    {sn(p.player_id)}
                                  </td>
                                  <td className="py-0.5 text-center win-text tabular-nums">{s?.wins ?? 0}</td>
                                  <td className="py-0.5 text-center loss-text tabular-nums">{s?.losses ?? 0}</td>
                                  <td className="py-0.5 text-right text-slate-500 tabular-nums text-xs">
                                    {total > 0 ? `${Math.round((s.wins / total) * 100)}%` : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {sortedParts.map(p => (
                          <div key={p.player_id} className="flex items-center gap-3 text-sm">
                            <span className="text-slate-600 w-5 text-right font-mono text-xs">
                              {p.final_position ?? '—'}
                            </span>
                            <span className={p.final_position === 1 ? 'text-slate-100 font-semibold' : 'text-slate-400'}>
                              {sn(p.player_id)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Round robin match results — expandable H2H pairs */}
                {tournamentPairs.length > 0 && (
                  <div className="border-t border-pool-border/50 mt-1 pt-3">
                    <button
                      onClick={() => setExpandedMatches(prev => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
                    >
                      <span className={`text-xs transition-transform duration-200 ${matchesExpanded ? 'rotate-180' : ''}`}>▾</span>
                      <span>Match results</span>
                    </button>

                    {matchesExpanded && (
                      <div className="mt-3 space-y-2">
                        {tournamentPairs.map(pair => {
                          const { a, b, left, right, leftW, rightW } = pair
                          const pairKey = [a, b].sort().join('-')
                          const isOpen = expandedPairKey === pairKey
                          const sortedMatches = [...pair.matches].sort((x, y) => {
                            const d = new Date(x.played_at) - new Date(y.played_at)
                            if (d !== 0) return d
                            return (x.created_at ?? '').localeCompare(y.created_at ?? '')
                          })

                          return (
                            <div key={pairKey} className="border border-pool-border rounded-lg overflow-hidden">
                              <button
                                onClick={() => setExpandedPairs(prev => ({
                                  ...prev,
                                  [t.id]: isOpen ? null : pairKey,
                                }))}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-pool-elevated transition-colors"
                              >
                                <div className={`flex items-center gap-2 flex-1 justify-end min-w-0 ${leftW > rightW ? 'win-text' : leftW < rightW ? 'loss-text' : 'text-slate-400'}`}>
                                  <span className="font-semibold truncate text-sm">{nameOf(left)}</span>
                                  <Avatar name={nameOf(left)} src={globalAvatarMap[left]} size="sm" />
                                </div>
                                <span className="font-mono text-base font-bold text-slate-300 tabular-nums w-12 text-center shrink-0">
                                  {leftW}–{rightW}
                                </span>
                                <div className={`flex items-center gap-2 flex-1 min-w-0 ${rightW > leftW ? 'win-text' : rightW < leftW ? 'loss-text' : 'text-slate-400'}`}>
                                  <Avatar name={nameOf(right)} src={globalAvatarMap[right]} size="sm" />
                                  <span className="font-semibold truncate text-sm">{nameOf(right)}</span>
                                </div>
                                <div className="flex items-center gap-2 w-20 justify-end shrink-0">
                                  <span className="text-slate-600 text-xs">{sortedMatches.length} match{sortedMatches.length !== 1 ? 'es' : ''}</span>
                                  <span className={`text-slate-500 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                                </div>
                              </button>

                              {isOpen && (
                                <div className="border-t border-pool-border">
                                  {sortedMatches.map(m => {
                                    const leftWon = m.winner_id === left
                                    const rightWon = m.winner_id === right
                                    const isBo3 = m.format === 'best_of_3'
                                    const games = m.games ?? []
                                    const leftScore = games.filter(g => g.winner_id === left).length
                                    const rightScore = games.filter(g => g.winner_id === right).length
                                    const leftGames = isBo3 ? gameSeq(games, left) : null
                                    const rightGames = isBo3 ? gameSeq(games, right) : null
                                    return (
                                      <div key={m.id} className="px-4 py-2.5 flex items-center gap-2 border-t border-pool-border/40 first:border-t-0">
                                        <span className="text-slate-600 text-xs font-mono w-14 shrink-0">{formatDateShort(m.played_at)}</span>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                                            {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                                            {isBo3 && <span className={`font-bold tabular-nums text-sm shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                                            <span className={`font-semibold text-sm truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameOf(left)}</span>
                                          </div>
                                          <span className="text-slate-600 text-xs shrink-0 w-5 text-center">vs</span>
                                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <span className={`font-semibold text-sm truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameOf(right)}</span>
                                            {isBo3 && <span className={`font-bold tabular-nums text-sm shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                                            {rightGames && <span className="text-slate-500 text-xs shrink-0">({rightGames})</span>}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bracket match result popup */}
      {bracketPopup && (() => {
        const { match, actualMatch, tournamentName, totalRounds } = bracketPopup
        const roundName = getBracketRoundName(match.round_number - 1, totalRounds)
        const p1Name = sn(match.player1_id)
        const p2Name = match.is_bye ? 'BYE' : sn(match.player2_id)
        const p1Won = match.winner_id === match.player1_id
        const p2Won = match.winner_id === match.player2_id
        const isBo3 = actualMatch?.format === 'best_of_3'
        const games = actualMatch?.games ?? []
        const p1Score = games.filter(g => g.winner_id === match.player1_id).length
        const p2Score = games.filter(g => g.winner_id === match.player2_id).length
        const p1Games = isBo3 ? gameSeq(games, match.player1_id) : null
        const p2Games = isBo3 ? gameSeq(games, match.player2_id) : null
        return (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setBracketPopup(null)}
          >
            <div
              className="card max-w-sm w-full p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="section-header mb-0">{tournamentName}</p>
                  <p className="text-slate-300 text-sm font-semibold mt-0.5">{roundName}</p>
                </div>
                <button
                  onClick={() => setBracketPopup(null)}
                  className="text-slate-600 hover:text-slate-300 transition-colors text-lg leading-none shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="text-center mb-3">
                <span className="badge-green">{p1Won ? p1Name : p2Name} wins</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                  {p1Games && <span className="text-slate-500 text-xs shrink-0">({p1Games})</span>}
                  {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${p1Won ? 'win-text' : 'loss-text'}`}>{p1Score}</span>}
                  <span className={`font-bold text-base truncate ${p1Won ? 'text-slate-100' : 'text-slate-500'}`}>{p1Name}</span>
                  <Avatar name={p1Name} src={globalAvatarMap[match.player1_id]} size="sm" />
                </div>
                <span className="text-slate-600 text-sm shrink-0 w-6 text-center">vs</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Avatar name={p2Name} src={globalAvatarMap[match.player2_id]} size="sm" />
                  <span className={`font-bold text-base truncate ${p2Won ? 'text-slate-100' : 'text-slate-500'}`}>{p2Name}</span>
                  {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${p2Won ? 'win-text' : 'loss-text'}`}>{p2Score}</span>}
                  {p2Games && <span className="text-slate-500 text-xs shrink-0">({p2Games})</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
