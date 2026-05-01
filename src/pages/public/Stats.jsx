import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Avatar from '../../components/ui/Avatar'

// ─── Computation helpers ──────────────────────────────────────────────────────

function computePlayerStats(matches, pid) {
  // matches sorted ascending by date
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

function computeOverallRecords(allStats, playerIds, matches, h2hData) {
  const withGames = playerIds.filter(id => (allStats[id]?.total ?? 0) > 0)

  const mostId = [...withGames].sort((a, b) => (allStats[b]?.total ?? 0) - (allStats[a]?.total ?? 0))[0] ?? null
  const qualified = withGames.filter(id => (allStats[id]?.total ?? 0) >= 5)
  const leastId = [...qualified].sort((a, b) => (allStats[a]?.total ?? 0) - (allStats[b]?.total ?? 0))[0] ?? null

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

  const rarest = [...h2hData]
    .sort((a, b) => a.matches_played - b.matches_played)[0] ?? null

  return { mostId, leastId, longestWin, longestLoss, busiestDay, rarest }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function RecordCard({ label, name, nameId, value, valueCls = 'text-pool-accent', sub }) {
  return (
    <div className="card p-4 space-y-0.5">
      <p className="section-header">{label}</p>
      {nameId
        ? <Link to={`/player/${nameId}`} className="text-slate-100 font-semibold text-sm hover:text-pool-accent transition-colors block">{name}</Link>
        : name && <p className="text-slate-100 font-semibold text-sm">{name}</p>
      }
      <p className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs">{sub}</p>}
    </div>
  )
}

function LastTenBadges({ results, size = 'md' }) {
  const dim = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
  if (!results.length) return <span className="text-slate-600 text-xs">—</span>
  return (
    <div className="flex gap-0.5 flex-wrap">
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
  const [players, setPlayers] = useState([])
  const [allStats, setAllStats] = useState({})
  const [records, setRecords] = useState(null)
  const [nameMap, setNameMap] = useState({})

  useEffect(() => {
    async function load() {
      const [{ data: matches }, { data: p }, { data: h2h }] = await Promise.all([
        supabase
          .from('matches')
          .select('id, played_at, player1_id, player2_id, winner_id')
          .not('winner_id', 'is', null)
          .order('played_at', { ascending: true }),
        supabase.from('players').select('id, name, avatar_url').eq('active', true),
        supabase.from('head_to_head_stats').select('*'),
      ])

      const playerList = p ?? []
      const matchList = matches ?? []
      const playerIds = playerList.map(pl => pl.id)

      const stats = {}
      for (const pid of playerIds) stats[pid] = computePlayerStats(matchList, pid)

      const recs = computeOverallRecords(stats, playerIds, matchList, h2h ?? [])

      setPlayers([...playerList].sort((a, b) => (stats[b.id]?.total ?? 0) - (stats[a.id]?.total ?? 0)))
      setAllStats(stats)
      setRecords(recs)
      setNameMap(buildDisplayNames(playerList))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''
  const hasData = players.some(p => (allStats[p.id]?.total ?? 0) > 0)

  return (
    <div className="space-y-8">
      <div>
        <p className="section-header">Records &amp; Breakdown</p>
        <h1 className="page-title">Stats</h1>
      </div>

      {!hasData ? (
        <div className="card p-8 text-center text-slate-600">No match data yet.</div>
      ) : (
        <>
          {/* Overall Records */}
          {records && (
            <div>
              <p className="section-header">Overall Records</p>
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
                    sub="min. 5 played"
                  />
                )}

                {records.longestWin.count > 0 && (
                  <RecordCard
                    label="Longest Win Streak"
                    name={n(records.longestWin.id)}
                    nameId={records.longestWin.id}
                    value={`W${records.longestWin.count}`}
                    valueCls="win-text"
                  />
                )}

                {records.longestLoss.count > 0 && (
                  <RecordCard
                    label="Longest Loss Streak"
                    name={n(records.longestLoss.id)}
                    nameId={records.longestLoss.id}
                    value={`L${records.longestLoss.count}`}
                    valueCls="loss-text"
                  />
                )}

                {records.busiestDay && (
                  <RecordCard
                    label="Busiest Day"
                    name={new Date(records.busiestDay.date + 'T12:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    value={records.busiestDay.count}
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

              </div>
            </div>
          )}

          {/* Player Breakdown */}
          <div>
            <p className="section-header">Player Breakdown</p>
            <div className="card overflow-x-auto">
              <table className="table-base min-w-full">
                <colgroup>
                  <col />
                  <col className="w-14" />
                  <col className="w-14" />
                  <col className="w-20" />
                  <col className="w-24 hidden sm:table-column" />
                  <col className="w-44 hidden sm:table-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="pl-5 text-left">Player</th>
                    <th className="text-center">Played</th>
                    <th className="text-center">Win %</th>
                    <th className="text-center">Best</th>
                    <th className="text-right hidden sm:table-cell">Last Played</th>
                    <th className="text-right pr-5 hidden sm:table-cell">Last 10</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => {
                    const s = allStats[p.id]
                    if (!s || s.total === 0) return null

                    const days = s.lastPlayed
                      ? Math.floor((Date.now() - new Date(s.lastPlayed).getTime()) / 86400000)
                      : null
                    const lastStr = days === null ? '—'
                      : days === 0 ? 'Today'
                      : days === 1 ? 'Yesterday'
                      : days < 30 ? `${days}d ago`
                      : days < 365 ? `${Math.floor(days / 30)}mo ago`
                      : `${Math.floor(days / 365)}yr ago`

                    const best = s.maxWin >= s.maxLoss
                      ? { label: `W${s.maxWin}`, cls: 'win-text' }
                      : { label: `L${s.maxLoss}`, cls: 'loss-text' }

                    return (
                      <tr key={p.id}>
                        <td className="pl-5">
                          <Link
                            to={`/player/${p.id}`}
                            className="flex items-center gap-2 font-semibold text-slate-100 hover:text-pool-accent transition-colors"
                          >
                            <Avatar name={p.name} src={p.avatar_url} size="sm" />
                            {n(p.id)}
                          </Link>
                        </td>
                        <td className="text-center text-slate-300 tabular-nums text-sm">{s.total}</td>
                        <td className="text-center text-slate-300 tabular-nums text-sm font-mono">
                          {(s.winRate * 100).toFixed(0)}%
                        </td>
                        <td className={`text-center font-mono text-sm tabular-nums ${best.cls}`}>
                          {s.maxWin > 0 || s.maxLoss > 0 ? best.label : '—'}
                        </td>
                        <td className="text-right text-slate-500 text-xs hidden sm:table-cell">{lastStr}</td>
                        <td className="text-right pr-5 hidden sm:table-cell">
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
        </>
      )}
    </div>
  )
}
