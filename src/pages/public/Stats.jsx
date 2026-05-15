import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import { computeEloRatings } from '../../lib/eloUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Avatar from '../../components/ui/Avatar'

// ─── Computation helpers ──────────────────────────────────────────────────────

function computeH2HFromMatches(matches) {
  const pairMap = {}
  for (const m of matches) {
    const [a, b] = [m.player1_id, m.player2_id].sort()
    const key = `${a}-${b}`
    if (!pairMap[key]) pairMap[key] = { player_a_id: a, player_b_id: b, player_a_wins: 0, player_b_wins: 0, matches_played: 0 }
    pairMap[key].matches_played++
    if (m.winner_id === a) pairMap[key].player_a_wins++
    else pairMap[key].player_b_wins++
  }
  return Object.values(pairMap)
}

function computePlayerStats(matches, pid) {
  const pm = matches.filter(m => m.player1_id === pid || m.player2_id === pid)
  if (!pm.length) return null

  const wins = pm.filter(m => m.winner_id === pid).length
  const total = pm.length

  let curW = 0, curL = 0, maxW = 0, maxL = 0
  for (const m of pm) {
    const won = m.winner_id === pid
    if (won) { curW++; curL = 0 } else { curL++; curW = 0 }
    if (curW > maxW) maxW = curW
    if (curL > maxL) maxL = curL
  }

  const rev = [...pm].reverse()
  let curStreakType = null, curStreakCount = 0
  if (rev.length) {
    curStreakType = rev[0].winner_id === pid ? 'W' : 'L'
    for (const m of rev) {
      const won = m.winner_id === pid
      if ((curStreakType === 'W') === won) curStreakCount++
      else break
    }
  }

  return {
    total,
    wins,
    losses: total - wins,
    winRate: total > 0 ? wins / total : 0,
    maxWin: maxW,
    maxLoss: maxL,
    curStreak: { type: curStreakType, count: curStreakCount },
    lastTen: rev.slice(0, 10).map(m => m.winner_id === pid ? 'W' : 'L'),
    lastPlayed: rev[0]?.played_at ?? null,
  }
}

function computePlayerBo3Stats(matches, pid) {
  const pm = matches.filter(m => (m.player1_id === pid || m.player2_id === pid) && m.format === 'best_of_3')
  if (!pm.length) return null
  const wins = pm.filter(m => m.winner_id === pid).length
  const total = pm.length
  let comebacks = 0
  for (const m of pm) {
    if (m.winner_id !== pid) continue
    if (!m.games || m.games.length < 3) continue
    const sorted = [...m.games].sort((a, b) => a.game_number - b.game_number)
    if (sorted[0]?.winner_id !== pid) comebacks++
  }
  return { total, wins, losses: total - wins, winRate: total > 0 ? wins / total : 0, comebacks }
}

function computeOverallRecords(allStats, playerIds, matches, h2hData) {
  const withGames = playerIds.filter(id => (allStats[id]?.total ?? 0) > 0)

  const mostId = [...withGames].sort((a, b) => (allStats[b]?.total ?? 0) - (allStats[a]?.total ?? 0))[0] ?? null
  const leastId = withGames.length > 1
    ? [...withGames].filter(id => id !== mostId).sort((a, b) => (allStats[a]?.total ?? 0) - (allStats[b]?.total ?? 0))[0] ?? null
    : null

  const longestWin = withGames.reduce((best, pid) => {
    const v = allStats[pid]?.maxWin ?? 0
    return v > best.count ? { id: pid, count: v } : best
  }, { id: null, count: 0 })

  const longestLoss = withGames.reduce((best, pid) => {
    const v = allStats[pid]?.maxLoss ?? 0
    return v > best.count ? { id: pid, count: v } : best
  }, { id: null, count: 0 })

  const dateCounts = {}
  for (const m of matches) {
    const d = m.played_at.slice(0, 10)
    dateCounts[d] = (dateCounts[d] || 0) + 1
  }
  const busiestEntry = Object.entries(dateCounts).sort((a, b) => b[1] - a[1])[0]
  const busiestDay = busiestEntry ? { date: busiestEntry[0], count: busiestEntry[1] } : null

  const rarest = [...h2hData].sort((a, b) => a.matches_played - b.matches_played)[0] ?? null

  return { mostId, leastId, longestWin, longestLoss, busiestDay, rarest }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function RecordCard({ label, name, nameId, value, valueCls = 'text-pool-accent', sub }) {
  return (
    <div className="card p-4 flex flex-col">
      <p className="section-header">{label}</p>
      <div className="mt-auto pt-1.5 space-y-0.5">
        {nameId
          ? <Link to={`/player/${nameId}`} className="text-slate-100 font-semibold text-sm hover:text-pool-accent transition-colors block">{name}</Link>
          : name && <p className="text-slate-100 font-semibold text-sm">{name}</p>
        }
        <p className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
        {sub && <p className="text-slate-600 text-xs">{sub}</p>}
      </div>
    </div>
  )
}

function LastTenBadges({ results, size = 'md' }) {
  const dim = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
  if (!results.length) return <span className="text-slate-600 text-xs">—</span>
  return (
    <div className="flex gap-0.5">
      {results.map((r, i) => (
        <span
          key={i}
          className={`${dim} flex items-center justify-center rounded font-bold ${
            r === 'W'
              ? 'bg-green-900/50 text-pool-win border border-green-800/60'
              : 'bg-red-900/50 text-pool-loss border border-red-900/60'
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Stats() {
  const [loading, setLoading] = useState(true)
  const [rawMatches, setRawMatches] = useState([])
  const [allSeasons, setAllSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(null)
  const [players, setPlayers] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [selectedView, setSelectedView] = useState('current')

  useEffect(() => {
    async function load() {
      const [{ data: matches }, { data: p }, { data: seasons }] = await Promise.all([
        supabase
          .from('matches')
          .select('id, played_at, format, player1_id, player2_id, winner_id, games(game_number, winner_id)')
          .not('winner_id', 'is', null)
          .is('tournament_id', null)
          .order('played_at', { ascending: true }),
        supabase.from('players').select('id, name, avatar_url').eq('active', true),
        supabase.from('seasons').select('id, name, start_date, end_date, is_active, stats_available').order('start_date', { ascending: false }),
      ])

      const seasonList = seasons ?? []
      setRawMatches(matches ?? [])
      setPlayers(p ?? [])
      setAllSeasons(seasonList)
      setActiveSeason(seasonList.find(s => s.is_active) ?? null)
      setNameMap(buildDisplayNames(p ?? []))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  // ─── Filter matches based on selected view ───────────────────────────────────

  const filteredMatches = (() => {
    if (selectedView === 'current') {
      if (!activeSeason) return rawMatches
      return rawMatches.filter(m =>
        m.played_at >= activeSeason.start_date &&
        m.played_at <= activeSeason.end_date + 'T23:59:59'
      )
    }
    if (selectedView === 'all_time') {
      return rawMatches
    }
    const season = allSeasons.find(s => s.id === selectedView)
    if (season) return rawMatches.filter(m =>
      m.played_at >= season.start_date && m.played_at <= season.end_date + 'T23:59:59'
    )
    return rawMatches
  })()

  // ─── Compute stats from filtered matches ─────────────────────────────────────

  const playerIds = players.map(p => p.id)
  const h2h = computeH2HFromMatches(filteredMatches)

  const allStats = {}
  for (const pid of playerIds) allStats[pid] = computePlayerStats(filteredMatches, pid)

  const bo3ByPid = {}
  for (const pid of playerIds) bo3ByPid[pid] = computePlayerBo3Stats(filteredMatches, pid)
  const bo3WithData = playerIds.filter(id => bo3ByPid[id])
  const bo3BestWin = bo3WithData.filter(id => bo3ByPid[id].total >= 3).sort((a, b) => bo3ByPid[b].winRate - bo3ByPid[a].winRate)[0] ?? null
  const bo3MostComebacks = bo3WithData.filter(id => bo3ByPid[id].comebacks > 0).sort((a, b) => bo3ByPid[b].comebacks - bo3ByPid[a].comebacks)[0] ?? null
  const bo3Records = {
    bestWinRate: bo3BestWin ? { id: bo3BestWin, pct: bo3ByPid[bo3BestWin].winRate } : null,
    mostComebacks: bo3MostComebacks ? { id: bo3MostComebacks, count: bo3ByPid[bo3MostComebacks].comebacks } : null,
  }

  const records = computeOverallRecords(allStats, playerIds, filteredMatches, h2h)

  // For date-sensitive stats (streaks, busiest day), exclude past seasons with randomised dates.
  // Only exclude seasons that have already ended — never exclude a range that covers today.
  const todayStr = new Date().toISOString().slice(0, 10)
  const excludedRanges = allSeasons
    .filter(s => !s.stats_available && s.end_date < todayStr)
    .map(s => ({ from: s.start_date, to: s.end_date + 'T23:59:59' }))
  const dateReliableMatches = excludedRanges.length > 0
    ? filteredMatches.filter(m => !excludedRanges.some(r => m.played_at >= r.from && m.played_at <= r.to))
    : filteredMatches
  const dateStats = {}
  for (const pid of playerIds) dateStats[pid] = computePlayerStats(dateReliableMatches, pid)
  const dateRecords = computeOverallRecords(dateStats, playerIds, dateReliableMatches, h2h)

  const eloRatings = computeEloRatings(filteredMatches)

  const sortedPlayers = [...players].sort((a, b) => (allStats[b.id]?.total ?? 0) - (allStats[a.id]?.total ?? 0))
  const bo3Map = Object.fromEntries(playerIds.map(pid => [pid, bo3ByPid[pid]?.comebacks ?? 0]))

  const hasData = players.some(p => (allStats[p.id]?.total ?? 0) > 0)
  const n = id => nameMap[id] ?? ''

  // ─── Season selector options ─────────────────────────────────────────────────

  const viewOptions = [
    ...(activeSeason ? [{ value: 'current', label: `Current Season` }] : []),
    ...allSeasons.filter(s =>
      s.id !== activeSeason?.id &&
      !s.is_active &&
      s.end_date < todayStr &&
      s.stats_available
    ).map(s => ({ value: s.id, label: s.name })),
    { value: 'all_time', label: 'All Time' },
  ]

  const selectedLabel = selectedView === 'current'
    ? activeSeason?.name ?? 'Current Season'
    : selectedView === 'all_time'
    ? 'All Time'
    : allSeasons.find(s => s.id === selectedView)?.name ?? ''

  return (
    <div className="space-y-8">
      <div>
        <p className="section-header">Records &amp; Breakdown</p>
        <h1 className="page-title">Bo3 Stats</h1>
      </div>

      {/* Season selector */}
      {viewOptions.length > 1 && (
        <div className="flex items-center gap-1 p-1 bg-pool-elevated rounded-lg w-fit">
          {viewOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedView(opt.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedView === opt.value
                  ? 'bg-pool-card text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="card p-8 text-center text-slate-600">No match data for {selectedLabel}.</div>
      ) : (
        <>
          {/* Records */}
          <div>
            <p className="section-header">Records</p>
            <p className="text-slate-600 text-xs -mt-2 mb-4">Non-tournament best-of-3 · {selectedLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              {records.mostId && allStats[records.mostId] && (
                <RecordCard
                  label="Most Matches"
                  name={n(records.mostId)}
                  nameId={records.mostId}
                  value={allStats[records.mostId].total}
                  valueCls="text-slate-300"
                />
              )}

              {records.leastId && allStats[records.leastId] && (
                <RecordCard
                  label="Least Matches"
                  name={n(records.leastId)}
                  nameId={records.leastId}
                  value={allStats[records.leastId].total}
                  valueCls="text-slate-400"
                />
              )}

              {dateRecords.longestWin.count > 0 && (
                <RecordCard
                  label="Longest Win Streak"
                  name={n(dateRecords.longestWin.id)}
                  nameId={dateRecords.longestWin.id}
                  value={`W${dateRecords.longestWin.count}`}
                  valueCls="win-text"
                />
              )}

              {dateRecords.longestLoss.count > 0 && (
                <RecordCard
                  label="Longest Loss Streak"
                  name={n(dateRecords.longestLoss.id)}
                  nameId={dateRecords.longestLoss.id}
                  value={`L${dateRecords.longestLoss.count}`}
                  valueCls="loss-text"
                />
              )}

              {dateRecords.busiestDay && (
                <RecordCard
                  label="Busiest Day"
                  name={new Date(dateRecords.busiestDay.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  value={dateRecords.busiestDay.count}
                  valueCls="text-slate-300"
                  sub="matches played"
                />
              )}

              {records.rarest && (
                <RecordCard
                  label="Rarest Matchup"
                  name={`${n(records.rarest.player_a_id)} vs ${n(records.rarest.player_b_id)}`}
                  value={records.rarest.matches_played}
                  valueCls="text-slate-400"
                  sub={`match${records.rarest.matches_played !== 1 ? 'es' : ''} played`}
                />
              )}

              {bo3Records.bestWinRate && (
                <RecordCard
                  label="Best Win Rate"
                  name={n(bo3Records.bestWinRate.id)}
                  nameId={bo3Records.bestWinRate.id}
                  value={`${(bo3Records.bestWinRate.pct * 100).toFixed(0)}%`}
                  valueCls="text-pool-accent"
                  sub="min. 3 matches"
                />
              )}

              {bo3Records.mostComebacks && (
                <RecordCard
                  label="Most Comeback Wins"
                  name={n(bo3Records.mostComebacks.id)}
                  nameId={bo3Records.mostComebacks.id}
                  value={bo3Records.mostComebacks.count}
                  valueCls="text-slate-300"
                  sub="Won after losing game 1"
                />
              )}

            </div>
          </div>

          {/* Player Breakdown */}
          <div>
            <p className="section-header">Player Breakdown</p>
            <div className="card overflow-x-auto">
              <table className="table-base min-w-full">
                <colgroup>
                  <col />
                  <col className="w-10" />
                  <col className="w-10" />
                  <col className="w-10" />
                  <col className="w-14" />
                  <col className="w-20" />
                  <col className="w-12" />
                  <col className="w-20" />
                  <col className="w-56" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="pl-5 text-left sticky left-0 bg-pool-card z-10">Player</th>
                    <th className="text-center">P</th>
                    <th className="text-center">W</th>
                    <th className="text-center">L</th>
                    <th className="text-center">W%</th>
                    <th className="text-right pr-3">Rating</th>
                    <th className="text-center">Best</th>
                    <th className="text-center">Comebacks</th>
                    <th className="text-right pr-5 whitespace-nowrap">Last 10 <span className="text-slate-600 font-normal normal-case tracking-normal">← more recent · older →</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map(p => {
                    const s = allStats[p.id]
                    if (!s || s.total === 0) return null
                    const comebacks = bo3Map[p.id] ?? 0
                    const best = s.maxWin > 0 ? `W${s.maxWin}` : '—'
                    const elo = eloRatings[p.id]

                    return (
                      <tr key={p.id}>
                        <td className="pl-5 sticky left-0 bg-pool-card z-10">
                          <Link
                            to={`/player/${p.id}`}
                            className="flex items-center gap-2 font-semibold text-slate-100 hover:text-pool-accent transition-colors"
                          >
                            <Avatar name={p.name} src={p.avatar_url} size="sm" />
                            {n(p.id)}
                          </Link>
                        </td>
                        <td className="text-center text-slate-300 tabular-nums text-sm">{s.total}</td>
                        <td className="text-center win-text tabular-nums">{s.wins}</td>
                        <td className="text-center loss-text tabular-nums">{s.losses}</td>
                        <td className="text-center text-slate-300 tabular-nums text-sm font-mono">
                          {(s.winRate * 100).toFixed(0)}%
                        </td>
                        <td className="text-right pr-3 font-mono text-sm tabular-nums">
                          {elo
                            ? elo.isProvisional
                              ? <span className="text-slate-600">~{elo.rating}</span>
                              : <span className="text-slate-100">{elo.rating}</span>
                            : <span className="text-slate-700">—</span>}
                        </td>
                        <td className={`text-center font-mono text-sm tabular-nums ${s.maxWin > 0 ? 'win-text' : 'text-slate-600'}`}>
                          {best}
                        </td>
                        <td className="text-center text-slate-300 tabular-nums text-sm">
                          {comebacks > 0 ? comebacks : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="text-right pr-5">
                          <div className="flex gap-0.5 justify-end">
                            <LastTenBadges results={s.lastTen} size="sm" />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tournament */}
          <div>
            <p className="section-header">Tournament</p>
            <Link
              to="/tournament-stats"
              className="card p-4 flex items-center justify-between hover:bg-pool-elevated transition-colors group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-pool-accent transition-colors text-sm">
                  View Tournament Stats
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Records, win rates, and results from competitive tournament play
                </p>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
