import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Avatar from '../../components/ui/Avatar'

// ─── Computation helpers ──────────────────────────────────────────────────────

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

function LastTenBadges({ results }) {
  if (!results?.length) return <span className="text-slate-600 text-xs">—</span>
  return (
    <div className="flex gap-0.5">
      {results.map((r, i) => (
        <span
          key={i}
          className={`w-5 h-5 text-[10px] flex items-center justify-center rounded font-bold ${
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

export default function TournamentStats() {
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [rawMatches, setRawMatches] = useState([])
  const [rawTournaments, setRawTournaments] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [allSeasons, setAllSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(null)
  const [selectedView, setSelectedView] = useState('current')

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: m }, { data: t }, { data: seasons }] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url').eq('active', true),
        supabase
          .from('matches')
          .select('id, played_at, format, player1_id, player2_id, winner_id, tournament_id')
          .not('tournament_id', 'is', null)
          .not('winner_id', 'is', null)
          .order('played_at', { ascending: true }),
        supabase
          .from('tournaments')
          .select('id, date, tournament_participants(player_id, final_position)')
          .order('date', { ascending: true }),
        supabase.from('seasons').select('id, name, start_date, end_date, is_active, stats_available').order('start_date', { ascending: false }),
      ])

      const seasonList = seasons ?? []
      setPlayers(p ?? [])
      setRawMatches(m ?? [])
      setRawTournaments(t ?? [])
      setNameMap(buildDisplayNames(p ?? []))
      setAllSeasons(seasonList)
      setActiveSeason(seasonList.find(s => s.is_active) ?? null)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''
  const playerIds = players.map(p => p.id)
  const todayStr = new Date().toISOString().slice(0, 10)

  // ─── Filter matches and tournaments based on selected view ───────────────────

  const seasonRange = (() => {
    if (selectedView === 'current') return activeSeason ? { from: activeSeason.start_date, to: activeSeason.end_date } : null
    if (selectedView === 'all_time') return null
    const s = allSeasons.find(s => s.id === selectedView)
    return s ? { from: s.start_date, to: s.end_date } : null
  })()

  const filteredMatches = seasonRange
    ? rawMatches.filter(m => m.played_at >= seasonRange.from && m.played_at <= seasonRange.to + 'T23:59:59')
    : rawMatches

  const filteredTournaments = seasonRange
    ? rawTournaments.filter(t => t.date >= seasonRange.from && t.date <= seasonRange.to)
    : rawTournaments

  // ─── Compute stats from filtered data ────────────────────────────────────────

  const allStats = {}
  for (const pid of playerIds) allStats[pid] = computePlayerStats(filteredMatches, pid)

  const tWins = {}
  const tEntered = {}
  for (const t of filteredTournaments) {
    for (const p of t.tournament_participants ?? []) {
      tEntered[p.player_id] = (tEntered[p.player_id] ?? 0) + 1
      if (p.final_position === 1) tWins[p.player_id] = (tWins[p.player_id] ?? 0) + 1
    }
  }

  const withStats = playerIds.filter(id => (allStats[id]?.total ?? 0) > 0)
  const hasData = withStats.length > 0 || Object.keys(tEntered).length > 0

  const mostMatchesId = [...withStats].sort((a, b) => (allStats[b]?.total ?? 0) - (allStats[a]?.total ?? 0))[0] ?? null
  const bestWinRateId = withStats.filter(id => (allStats[id]?.total ?? 0) >= 3).sort((a, b) => (allStats[b]?.winRate ?? 0) - (allStats[a]?.winRate ?? 0))[0] ?? null
  const mostTourneysWonId = playerIds.filter(id => (tWins[id] ?? 0) > 0).sort((a, b) => (tWins[b] ?? 0) - (tWins[a] ?? 0))[0] ?? null
  const mostEnteredId = playerIds.filter(id => (tEntered[id] ?? 0) > 0).sort((a, b) => (tEntered[b] ?? 0) - (tEntered[a] ?? 0))[0] ?? null
  const longestWin = withStats.reduce((best, pid) => {
    const v = allStats[pid]?.maxWin ?? 0
    return v > best.count ? { id: pid, count: v } : best
  }, { id: null, count: 0 })
  const longestLoss = withStats.reduce((best, pid) => {
    const v = allStats[pid]?.maxLoss ?? 0
    return v > best.count ? { id: pid, count: v } : best
  }, { id: null, count: 0 })

  const playerBreakdown = [...players]
    .map(p => ({ ...p, stats: allStats[p.id], entered: tEntered[p.id] ?? 0, won: tWins[p.id] ?? 0 }))
    .filter(p => p.stats?.total > 0 || p.entered > 0)
    .sort((a, b) => (b.stats?.winRate ?? 0) - (a.stats?.winRate ?? 0) || (b.stats?.wins ?? 0) - (a.stats?.wins ?? 0))

  // ─── Season selector options ─────────────────────────────────────────────────

  const viewOptions = [
    ...(activeSeason ? [{ value: 'current', label: 'Current Season' }] : []),
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
        <p className="section-header">Competitive Play</p>
        <h1 className="page-title">Tournament Stats</h1>
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
        <div className="card p-8 text-center text-slate-600">No tournament data for {selectedLabel}.</div>
      ) : (
        <>
          {/* Record highlights */}
          <div>
            <p className="section-header">Records</p>
            <p className="text-slate-600 text-xs -mt-2 mb-4">Tournament matches · {selectedLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {mostTourneysWonId && (
                <RecordCard
                  label="Most Tournaments Won"
                  name={n(mostTourneysWonId)}
                  nameId={mostTourneysWonId}
                  value={tWins[mostTourneysWonId]}
                  valueCls="text-amber-400"
                  sub={tWins[mostTourneysWonId] === 1 ? 'tournament' : 'tournaments'}
                />
              )}
              {mostEnteredId && (
                <RecordCard
                  label="Most Tournaments Entered"
                  name={n(mostEnteredId)}
                  nameId={mostEnteredId}
                  value={tEntered[mostEnteredId]}
                  valueCls="text-slate-300"
                  sub={tEntered[mostEnteredId] === 1 ? 'tournament' : 'tournaments'}
                />
              )}
              {mostMatchesId && allStats[mostMatchesId] && (
                <RecordCard
                  label="Most Matches Played"
                  name={n(mostMatchesId)}
                  nameId={mostMatchesId}
                  value={allStats[mostMatchesId].total}
                  valueCls="text-slate-300"
                  sub="tournament matches"
                />
              )}
              {bestWinRateId && allStats[bestWinRateId] && (
                <RecordCard
                  label="Best Win Rate"
                  name={n(bestWinRateId)}
                  nameId={bestWinRateId}
                  value={`${(allStats[bestWinRateId].winRate * 100).toFixed(0)}%`}
                  valueCls="text-pool-accent"
                  sub="min. 3 matches"
                />
              )}
              {longestWin.count > 0 && (
                <RecordCard
                  label="Longest Win Streak"
                  name={n(longestWin.id)}
                  nameId={longestWin.id}
                  value={`W${longestWin.count}`}
                  valueCls="win-text"
                />
              )}
              {longestLoss.count > 0 && (
                <RecordCard
                  label="Longest Loss Streak"
                  name={n(longestLoss.id)}
                  nameId={longestLoss.id}
                  value={`L${longestLoss.count}`}
                  valueCls="loss-text"
                />
              )}
            </div>
          </div>

          {/* Player breakdown */}
          <div>
            <p className="section-header">Player Breakdown</p>
            <p className="text-slate-600 text-xs -mt-2 mb-3">Tournament matches only · {selectedLabel}</p>
            <div className="card overflow-x-auto">
              <table className="table-base min-w-full">
                <colgroup>
                  <col />
                  <col className="w-16" />
                  <col className="w-12" />
                  <col className="w-12" />
                  <col className="w-12" />
                  <col className="w-16" />
                  {selectedView !== 'all_time' && <col className="w-14" />}
                  {selectedView !== 'all_time' && <col className="w-56" />}
                </colgroup>
                <thead>
                  <tr>
                    <th className="pl-5 text-left sticky left-0 bg-pool-card z-10">Player</th>
                    <th className="text-center">Entered</th>
                    <th className="text-center">Won</th>
                    <th className="text-center">W</th>
                    <th className="text-center">L</th>
                    <th className="text-center">Win%</th>
                    {selectedView !== 'all_time' && <th className="text-center">Best</th>}
                    {selectedView !== 'all_time' && <th className="text-right pr-5 whitespace-nowrap">Last 10 <span className="text-slate-600 font-normal normal-case tracking-normal">← more recent · older →</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {playerBreakdown.map(p => {
                    const s = p.stats
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
                        <td className="text-center text-slate-500 tabular-nums text-sm">{p.entered || <span className="text-slate-700">—</span>}</td>
                        <td className="text-center tabular-nums text-sm">
                          {p.won > 0
                            ? <span className="text-amber-400">🏆{p.won > 1 ? ` ×${p.won}` : ''}</span>
                            : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="text-center win-text tabular-nums">{s?.wins ?? 0}</td>
                        <td className="text-center loss-text tabular-nums">{s?.losses ?? 0}</td>
                        <td className="text-center text-slate-300 font-mono tabular-nums text-sm">
                          {s ? `${(s.winRate * 100).toFixed(0)}%` : '—'}
                        </td>
                        {selectedView !== 'all_time' && (
                          <td className={`text-center font-mono text-sm tabular-nums ${s?.maxWin > 0 ? 'win-text' : 'text-slate-600'}`}>
                            {s?.maxWin > 0 ? `W${s.maxWin}` : '—'}
                          </td>
                        )}
                        {selectedView !== 'all_time' && (
                          <td className="text-right pr-5">
                            <div className="flex gap-0.5 justify-end">
                              <LastTenBadges results={s?.lastTen} />
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
