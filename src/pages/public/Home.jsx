import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateShort } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Avatar from '../../components/ui/Avatar'

const CURRENT_YEAR = new Date().getFullYear()

const PLAYER_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316',
]

const formatDate = formatDateShort

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
        active
          ? 'border-pool-accent text-slate-100'
          : 'border-transparent text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function gameSeq(games, playerId) {
  if (!games?.length) return null
  return [...games]
    .sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
    .map(g => g.winner_id === playerId ? 'W' : 'L')
    .join('-')
}

function computeAllStreaks(allTimeMatches, playerIds) {
  const streaks = {}
  for (const pid of playerIds) {
    let type = null, count = 0
    for (const m of allTimeMatches) {
      if (m.player1_id !== pid && m.player2_id !== pid) continue
      const won = m.winner_id === pid
      if (type === null) { type = won ? 'W' : 'L'; count = 1 }
      else if ((type === 'W') === won) count++
      else break
    }
    streaks[pid] = { type, count }
  }
  return streaks
}

// ─── Season graph helpers ─────────────────────────────────────────────────────

function buildSeasonData(yearMatches, standings) {
  const wins = {}
  standings.forEach(p => { wins[p.player_id] = 0 })

  const points = [{
    date: `1 Jan`,
    ...Object.fromEntries(standings.map(p => [p.player_name, 0])),
  }]

  for (const m of yearMatches) {
    if (!m.winner_id || wins[m.winner_id] === undefined) continue
    wins[m.winner_id]++
    points.push({
      date: formatDate(m.played_at),
      ...Object.fromEntries(standings.map(p => [p.player_name, wins[p.player_id]])),
    })
  }

  return points
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-pool-elevated border border-pool-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {[...payload].sort((a, b) => b.value - a.value).map(entry => (
        <p key={entry.name} style={{ color: entry.color }} className="leading-5">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

// ─── Leaderboard tab ──────────────────────────────────────────────────────────

function LeaderboardTab({ standings, playerStreaks, playerAvatars, nameMap }) {
  if (standings.length === 0) {
    return (
      <EmptyState
        title="No matches yet"
        message="Results will appear here once matches are recorded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <p className="section-header">Player Ranking</p>
      <div className="card overflow-hidden">
        <table className="table-base">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-16 hidden sm:table-column" />
            <col className="w-16" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">#</th>
              <th className="text-left">Player</th>
              <th className="text-center">W</th>
              <th className="text-center">L</th>
              <th className="text-center hidden sm:table-cell">Played</th>
              <th className="text-center">Strk</th>
              <th className="text-right pr-5">Win %</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const stk = playerStreaks[row.player_id]
              return (
                <tr key={row.player_id}>
                  <td className="pl-5 text-slate-600 font-mono text-xs">
                    {i === 0
                      ? <span>👑</span>
                      : i + 1}
                  </td>
                  <td>
                    <Link
                      to={`/player/${row.player_id}`}
                      className="flex items-center gap-2 font-semibold text-slate-100 hover:text-pool-accent transition-colors"
                    >
                      <Avatar
                        name={row.player_name}
                        src={playerAvatars[row.player_id]}
                        size="sm"
                      />
                      {nameMap[row.player_id] ?? row.player_name}
                    </Link>
                  </td>
                  <td className="text-center win-text tabular-nums">{row.wins}</td>
                  <td className="text-center loss-text tabular-nums">{row.losses}</td>
                  <td className="text-center text-slate-500 tabular-nums hidden sm:table-cell">{row.matches_played}</td>
                  <td className="text-center font-mono text-sm tabular-nums">
                    {stk?.count > 0 ? (
                      <span className={stk.type === 'W' ? 'win-text' : 'loss-text'}>
                        {stk.type}{stk.count}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-right pr-5 text-slate-300 font-mono text-sm tabular-nums">
                    {row.win_pct != null ? `${(row.win_pct * 100).toFixed(0)}%` : '—'}
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

// ─── Head-to-Head tab ─────────────────────────────────────────────────────────

function H2HTab({ players, h2hData, nameMap }) {
  const [expanded, setExpanded] = useState(null)
  const [matchHistory, setMatchHistory] = useState({})

  if (players.length < 2) {
    return (
      <EmptyState
        title="Not enough data"
        message="Head-to-head records appear once at least two players have played each other."
      />
    )
  }

  const n = id => nameMap[id] ?? ''

  const getRecord = (pidA, pidB) => {
    const record = h2hData.find(r =>
      (r.player_a_id === pidA && r.player_b_id === pidB) ||
      (r.player_a_id === pidB && r.player_b_id === pidA)
    )
    if (!record) return null
    const isA = record.player_a_id === pidA
    return {
      wins: isA ? record.player_a_wins : record.player_b_wins,
      losses: isA ? record.player_b_wins : record.player_a_wins,
    }
  }

  return (
    <div className="space-y-6">
      {/* Matrix */}
      <div className="card overflow-x-auto">
        <table className="table-base min-w-full">
          <thead>
            <tr>
              <th className="pl-5 text-left w-28">vs</th>
              {players.map(p => (
                <th key={p.player_id} className="text-center">
                  <span className="truncate block">{n(p.player_id)}</span>
                </th>
              ))}
              <th className="text-center pr-5">Overall</th>
            </tr>
          </thead>
          <tbody>
            {players.map(row => {
              let totalWins = 0, totalLosses = 0
              return (
                <tr key={row.player_id}>
                  <td className="pl-5 font-semibold text-slate-200 w-28">
                    <Link
                      to={`/player/${row.player_id}`}
                      className="hover:text-pool-accent transition-colors"
                    >
                      {n(row.player_id)}
                    </Link>
                  </td>
                  {players.map(col => {
                    if (col.player_id === row.player_id) {
                      return (
                        <td key={col.player_id} className="text-center text-slate-700">—</td>
                      )
                    }
                    const rec = getRecord(row.player_id, col.player_id)
                    if (rec) { totalWins += rec.wins; totalLosses += rec.losses }
                    return (
                      <td key={col.player_id} className="text-center tabular-nums text-sm">
                        {rec ? (
                          <span className={rec.wins > rec.losses ? 'win-text' : rec.wins < rec.losses ? 'loss-text' : 'text-slate-400'}>
                            {rec.wins}–{rec.losses}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-center pr-5 tabular-nums text-sm font-medium">
                    {totalWins + totalLosses > 0 ? (
                      <span className={totalWins > totalLosses ? 'win-text' : totalWins < totalLosses ? 'loss-text' : 'text-slate-400'}>
                        {totalWins}–{totalLosses}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-slate-700 text-xs text-center">
        Read across each row — e.g. "Tim vs Adam: 3–1" means Tim beat Adam 3 times, lost once
      </p>

      {/* Individual matchup cards */}
      <div>
        <p className="section-header">All matchups</p>
        <div className="space-y-2">
          {[...h2hData]
            .map(record => {
              const pA = players.find(p => p.player_id === record.player_a_id)
              const pB = players.find(p => p.player_id === record.player_b_id)
              if (!pA || !pB) return null
              const aFirst = pA.player_name.localeCompare(pB.player_name) <= 0
              const [left, right, leftW, rightW] = aFirst
                ? [pA, pB, record.player_a_wins, record.player_b_wins]
                : [pB, pA, record.player_b_wins, record.player_a_wins]
              return { record, left, right, leftW, rightW, sortKey: left.player_name + right.player_name }
            })
            .filter(Boolean)
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
            .map(({ record, left, right, leftW, rightW }) => {
              const key = [record.player_a_id, record.player_b_id].sort().join('-')
              const isOpen = expanded === key
              const history = matchHistory[key]

              const handleClick = async () => {
                if (isOpen) { setExpanded(null); return }
                setExpanded(key)
                if (history) return
                const { data } = await supabase
                  .from('matches')
                  .select(`
                    id, played_at, format,
                    player1:player1_id(id, name),
                    player2:player2_id(id, name),
                    winner:winner_id(id, name),
                    games(game_number, winner_id)
                  `)
                  .or(`and(player1_id.eq.${record.player_a_id},player2_id.eq.${record.player_b_id}),and(player1_id.eq.${record.player_b_id},player2_id.eq.${record.player_a_id})`)
                  .order('played_at', { ascending: false })
                setMatchHistory(prev => ({ ...prev, [key]: data ?? [] }))
              }

              return (
                <div key={key} className="card overflow-hidden">
                  <button
                    onClick={handleClick}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-pool-elevated transition-colors text-left"
                  >
                    <span className={`font-semibold flex-1 text-right ${leftW > rightW ? 'win-text' : leftW < rightW ? 'loss-text' : 'text-slate-400'}`}>
                      {n(left.player_id)}
                    </span>
                    <span className="font-mono text-lg font-bold text-slate-300 tabular-nums w-16 text-center">
                      {leftW}–{rightW}
                    </span>
                    <span className={`font-semibold flex-1 ${rightW > leftW ? 'win-text' : rightW < leftW ? 'loss-text' : 'text-slate-400'}`}>
                      {n(right.player_id)}
                    </span>
                    <div className="flex items-center gap-2 w-20 justify-end">
                      <span className="text-slate-600 text-xs">
                        {record.matches_played} match{record.matches_played !== 1 ? 'es' : ''}
                      </span>
                      <span className={`text-slate-500 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-pool-border">
                      {!history ? (
                        <div className="py-4 text-center text-slate-600 text-sm">Loading…</div>
                      ) : history.length === 0 ? (
                        <div className="py-4 text-center text-slate-600 text-sm">No matches found</div>
                      ) : (
                        <div>
                          {history.map(m => {
                            const { left, right, leftScore, rightScore, leftWon, rightWon } = orderedMatch(m)
                            const isBo3 = m.format === 'best_of_3'
                            const leftGames = isBo3 ? gameSeq(m.games, left?.id) : null
                            const rightGames = isBo3 ? gameSeq(m.games, right?.id) : null
                            return (
                              <div key={m.id} className="px-4 py-2.5 flex items-center gap-2 border-t border-pool-border/40 first:border-t-0">
                                <span className="text-slate-600 text-xs font-mono w-14 shrink-0">
                                  {formatDate(m.played_at)}
                                </span>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                                    {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                                    {isBo3 && <span className={`font-bold tabular-nums text-sm shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                                    <span className={`font-semibold text-sm truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(left?.id)}</span>
                                  </div>
                                  <span className="text-slate-600 text-xs shrink-0 w-5 text-center">vs</span>
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className={`font-semibold text-sm truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(right?.id)}</span>
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
                  )}
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}

// ─── Season graph tab ─────────────────────────────────────────────────────────

function SeasonTab({ standings, yearMatches }) {
  if (!yearMatches.length) {
    return (
      <EmptyState
        title="No matches this season"
        message="The cumulative wins graph will appear once matches are recorded."
      />
    )
  }

  const data = buildSeasonData(yearMatches, standings)

  return (
    <div className="space-y-4">
      <p className="section-header">Cumulative Wins — {CURRENT_YEAR}</p>
      <div className="card p-4 pt-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={value => <span style={{ color: '#94a3b8' }}>{value}</span>}
            />
            {standings.map((p, i) => (
              <Line
                key={p.player_id}
                type="monotone"
                dataKey={p.player_name}
                stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState('leaderboard')
  const [standings, setStandings] = useState([])
  const [recentMatches, setRecentMatches] = useState([])
  const [h2hData, setH2hData] = useState([])
  const [yearMatches, setYearMatches] = useState([])
  const [playerStreaks, setPlayerStreaks] = useState({})
  const [playerAvatars, setPlayerAvatars] = useState({})
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: stats }, { data: matches }, { data: h2h }, { data: yearM }, { data: allTime }, { data: players }] = await Promise.all([
        supabase
          .from('player_season_stats')
          .select('*')
          .eq('season', CURRENT_YEAR),

        supabase
          .from('matches')
          .select(`
            id, played_at, format,
            player1:player1_id(id, name, avatar_url),
            player2:player2_id(id, name, avatar_url),
            winner:winner_id(id, name),
            games(game_number, winner_id)
          `)
          .order('played_at', { ascending: false })
          .limit(8),

        supabase
          .from('head_to_head_stats')
          .select('*'),

        supabase
          .from('matches')
          .select('id, played_at, winner_id')
          .gte('played_at', `${CURRENT_YEAR}-01-01`)
          .lte('played_at', `${CURRENT_YEAR}-12-31`)
          .not('winner_id', 'is', null)
          .order('played_at', { ascending: true }),

        supabase
          .from('matches')
          .select('id, played_at, player1_id, player2_id, winner_id')
          .not('winner_id', 'is', null)
          .order('played_at', { ascending: false }),

        supabase
          .from('players')
          .select('id, name, avatar_url'),
      ])

      const sorted = [...(stats ?? [])].sort((a, b) => {
        const diff = (b.win_pct ?? 0) - (a.win_pct ?? 0)
        return diff !== 0 ? diff : b.wins - a.wins
      })

      const playerIds = sorted.map(s => s.player_id)
      const streaks = computeAllStreaks(allTime ?? [], playerIds)
      const avatars = Object.fromEntries((players ?? []).map(p => [p.id, p.avatar_url]))
      const names = buildDisplayNames(players ?? [])

      setStandings(sorted)
      setRecentMatches(matches ?? [])
      setH2hData(h2h ?? [])
      setYearMatches(yearM ?? [])
      setPlayerStreaks(streaks)
      setPlayerAvatars(avatars)
      setNameMap(names)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <p className="section-header">Season {CURRENT_YEAR}</p>
        <h1 className="text-3xl font-bold text-slate-100">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-pool-border flex gap-0">
        <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>
          Overall
        </TabButton>
        <TabButton active={tab === 'h2h'} onClick={() => setTab('h2h')}>
          Head to Head
        </TabButton>
        <TabButton active={tab === 'season'} onClick={() => setTab('season')}>
          Season Graph
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === 'leaderboard' && (
        <LeaderboardTab
          standings={standings}
          playerStreaks={playerStreaks}
          playerAvatars={playerAvatars}
          nameMap={nameMap}
        />
      )}
      {tab === 'h2h' && <H2HTab players={standings} h2hData={h2hData} nameMap={nameMap} />}
      {tab === 'season' && <SeasonTab standings={standings} yearMatches={yearMatches} />}

      {/* Recent results — only on Overall tab */}
      {tab === 'leaderboard' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-header mb-0">Recent Results</p>
            <Link to="/matches" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              View all →
            </Link>
          </div>

          {recentMatches.length === 0 ? (
            <div className="card">
              <EmptyState title="No matches recorded yet" />
            </div>
          ) : (
            <div className="space-y-2">
              {recentMatches.map(m => {
                const { left, right, leftScore, rightScore, leftWon, rightWon } = orderedMatch(m)
                const isBo3 = m.format === 'best_of_3'
                const leftGames = isBo3 ? gameSeq(m.games, left?.id) : null
                const rightGames = isBo3 ? gameSeq(m.games, right?.id) : null
                return (
                  <div key={m.id} className="card px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                        {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                        {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                        <span className={`font-bold text-base truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(left?.id)}</span>
                      </div>
                      <span className="text-slate-600 text-sm shrink-0 w-6 text-center">vs</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className={`font-bold text-base truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(right?.id)}</span>
                        {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                        {rightGames && <span className="text-slate-500 text-xs shrink-0">({rightGames})</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span>{formatDate(m.played_at)}</span>
                        <span>·</span>
                        <span>{isBo3 ? 'Best of 3' : 'Single game'}</span>
                      </div>
                      {m.winner && (
                        <span className="badge-green shrink-0">{n(m.winner?.id)} wins</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
