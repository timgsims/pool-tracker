import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateLong } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Avatar from '../../components/ui/Avatar'

const TABS = ['Leaderboard', 'Matches', 'Tournaments']

function gameSeq(games, playerId) {
  if (!games?.length) return null
  return [...games]
    .sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
    .map(g => g.winner_id === playerId ? 'W' : 'L')
    .join('-')
}

function formatSeasonDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function SeasonDetail() {
  const { id } = useParams()
  const [season, setSeason] = useState(null)
  const [matches, setMatches] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Leaderboard')

  useEffect(() => {
    supabase
      .from('seasons')
      .select('id, name, start_date, end_date, champion:champion_player_id(id, name)')
      .eq('id', id)
      .single()
      .then(({ data: s }) => {
        setSeason(s)
        return Promise.all([
          supabase
            .from('matches')
            .select(`
              id, played_at, format, winner_id,
              player1:player1_id(id, name, avatar_url),
              player2:player2_id(id, name, avatar_url),
              winner:winner_id(id, name),
              tournament:tournament_id(name),
              games(game_number, winner_id)
            `)
            .gte('played_at', s.start_date)
            .lte('played_at', s.end_date + 'T23:59:59')
            .order('played_at', { ascending: false }),
          supabase.from('players').select('id, name'),
          supabase
            .from('tournaments')
            .select(`
              id, name, date, format,
              tournament_participants(player_id, final_position, player:player_id(id, name))
            `)
            .gte('date', s.start_date)
            .lte('date', s.end_date)
            .order('date', { ascending: false }),
        ])
      })
      .then(([{ data: m }, { data: p }, { data: t }]) => {
        setMatches(m ?? [])
        setNameMap(buildDisplayNames(p ?? []))
        setTournaments(t ?? [])
        setLoading(false)
      })
  }, [id])

  if (loading || !season) return <LoadingSpinner />

  const n = pid => nameMap[pid] ?? ''

  // Compute leaderboard from match results
  const playerStats = {}
  for (const m of matches) {
    if (!m.winner_id || !m.player1 || !m.player2) continue
    const loserId = m.player1.id === m.winner_id ? m.player2.id : m.player1.id
    if (!playerStats[m.winner_id]) playerStats[m.winner_id] = { wins: 0, losses: 0 }
    if (!playerStats[loserId]) playerStats[loserId] = { wins: 0, losses: 0 }
    playerStats[m.winner_id].wins++
    playerStats[loserId].losses++
  }
  const leaderboard = Object.entries(playerStats)
    .map(([pid, s]) => ({ pid, ...s, total: s.wins + s.losses, pct: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0 }))
    .sort((a, b) => b.pct - a.pct || b.wins - a.wins)

  // Cross-tournament name map for Tournaments tab
  const allTourneyPlayers = Object.values(
    tournaments.flatMap(t => t.tournament_participants ?? [])
      .filter(p => p.player?.id)
      .reduce((acc, p) => { acc[p.player.id] = p.player; return acc }, {})
  )
  const tourneyNameMap = buildDisplayNames(allTourneyPlayers)
  const sn = pid => tourneyNameMap[pid] ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="section-header">
          <Link to="/seasons" className="hover:text-slate-300 transition-colors">Archive</Link>
          {' · '}
          {season.name}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="page-title">{season.name}</h1>
          {season.champion && (
            <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/40">
              <span className="text-amber-400 text-sm">🏆</span>
              <span className="text-amber-300 text-sm font-semibold">{season.champion.name}</span>
            </div>
          )}
        </div>
        <p className="text-slate-500 text-sm">
          {formatSeasonDate(season.start_date)}
          {' — '}
          {formatSeasonDate(season.end_date)}
          {' · '}
          {matches.length} matches
          {tournaments.length > 0 && ` · ${tournaments.length} tournaments`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pool-border">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-pool-accent text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {tab === 'Leaderboard' && (
        leaderboard.length === 0 ? (
          <div className="card">
            <EmptyState title="No completed matches in this season" />
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <colgroup>
                <col className="w-8" />
                <col />
                <col className="w-12" />
                <col className="w-12" />
                <col className="w-12" />
                <col className="w-16" />
              </colgroup>
              <thead>
                <tr>
                  <th className="pl-5 text-left">#</th>
                  <th className="text-left">Player</th>
                  <th className="text-center">W</th>
                  <th className="text-center">L</th>
                  <th className="text-center">GP</th>
                  <th className="text-right pr-5">Win%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(({ pid, wins, losses, total, pct }, i) => (
                  <tr key={pid}>
                    <td className="pl-5 text-slate-600 font-mono text-xs">{i + 1}</td>
                    <td className={i === 0 ? 'font-semibold text-slate-100' : 'text-slate-300'}>{n(pid)}</td>
                    <td className="text-center win-text tabular-nums">{wins}</td>
                    <td className="text-center loss-text tabular-nums">{losses}</td>
                    <td className="text-center text-slate-500 tabular-nums">{total}</td>
                    <td className="text-right pr-5 text-slate-400 tabular-nums">{Math.round(pct * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Matches */}
      {tab === 'Matches' && (
        matches.length === 0 ? (
          <div className="card">
            <EmptyState title="No matches in this season" />
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map(m => {
              const { left, right, leftScore, rightScore, leftWon, rightWon } = orderedMatch(m)
              const isBo3 = m.format === 'best_of_3'
              const leftGames = isBo3 ? gameSeq(m.games, left?.id) : null
              const rightGames = isBo3 ? gameSeq(m.games, right?.id) : null
              return (
                <div key={m.id} className="card px-5 py-4">
                  {m.winner && (
                    <div className="text-center mb-2">
                      <span className="badge-green">{n(m.winner.id)} wins</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                      {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                      <span className={`font-bold text-base truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(left?.id)}</span>
                      <Avatar name={left?.name} src={left?.avatar_url} size="sm" />
                    </div>
                    <span className="text-slate-600 text-sm shrink-0 w-6 text-center">vs</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Avatar name={right?.name} src={right?.avatar_url} size="sm" />
                      <span className={`font-bold text-base truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(right?.id)}</span>
                      {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                      {rightGames && <span className="text-slate-500 text-xs shrink-0">({rightGames})</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-slate-600 mt-2">
                    <span>{formatDateLong(m.played_at)}</span>
                    <span>·</span>
                    <span>{m.tournament
                      ? (isBo3 ? 'Tournament · Bo3' : 'Tournament · Single game')
                      : (isBo3 ? 'Best of 3' : 'Single game')
                    }</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Tournaments */}
      {tab === 'Tournaments' && (
        tournaments.length === 0 ? (
          <div className="card">
            <EmptyState title="No tournaments in this season" />
          </div>
        ) : (
          <div className="space-y-4">
            {tournaments.map(t => {
              const parts = t.tournament_participants ?? []
              const winner = parts.find(p => p.final_position === 1)
              const hasPositions = parts.some(p => p.final_position !== null)
              const sortedParts = hasPositions
                ? [...parts].sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99)).filter(p => p.final_position !== null)
                : []
              return (
                <div key={t.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-100 text-lg leading-tight">{t.name}</h2>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        {t.format === 'round_robin' ? 'Round Robin' : 'Single Elimination'}
                        {' · '}
                        {parts.length} players
                      </p>
                    </div>
                    {winner ? (
                      <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/40">
                        <span className="text-amber-400 text-sm">🏆</span>
                        <span className="text-amber-300 text-sm font-semibold">{sn(winner.player_id)}</span>
                      </div>
                    ) : (
                      <span className="badge-gray shrink-0">In Progress</span>
                    )}
                  </div>
                  {sortedParts.length > 0 && (
                    <div className="mt-3 border-t border-pool-border/50 pt-3 space-y-1">
                      {sortedParts.map(p => (
                        <div key={p.player_id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-600 w-5 text-right font-mono text-xs">{p.final_position}</span>
                          <span className={p.final_position === 1 ? 'text-slate-100 font-semibold' : 'text-slate-400'}>
                            {sn(p.player_id)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
