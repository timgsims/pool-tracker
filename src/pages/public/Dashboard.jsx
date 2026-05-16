import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import { computeEloRatings, buildEloStandings } from '../../lib/eloUtils'
import BracketView from '../../components/tournament/BracketView'

const SLIDE_MS = 15000
const REFRESH_MS = 60000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBracketRoundName(roundNumber, totalRounds) {
  const fromEnd = totalRounds - roundNumber
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Final'
  if (fromEnd === 2) return 'Quarter-Final'
  return `Round ${roundNumber}`
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

function getMatchDisplay(m, nameMap) {
  const n1 = nameMap[m.player1_id] ?? ''
  const n2 = nameMap[m.player2_id] ?? ''
  const p1First = n1.localeCompare(n2) <= 0
  const leftId = p1First ? m.player1_id : m.player2_id
  const rightId = p1First ? m.player2_id : m.player1_id
  const leftWon = m.winner_id === leftId
  const isBo3 = m.format === 'best_of_3'
  const games = [...(m.games ?? [])].sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
  const leftScore = games.filter(g => g.winner_id === leftId).length
  const rightScore = games.filter(g => g.winner_id === rightId).length
  const gameSeq = isBo3 && games.length
    ? games.map(g => g.winner_id === leftId ? 'W' : 'L').join('-')
    : null
  return { leftId, rightId, leftWon, rightWon: !leftWon, leftScore, rightScore, isBo3, gameSeq }
}

// ─── Shared header ────────────────────────────────────────────────────────────

function ViewHeader({ title, subtitle, clock }) {
  return (
    <div className="flex items-start justify-between mb-8 shrink-0">
      <div>
        <p className="text-pool-accent text-sm font-bold tracking-widest uppercase mb-1">{subtitle}</p>
        <h2 className="text-5xl font-bold text-slate-100 leading-tight">{title}</h2>
      </div>
      {clock && (
        <p className="text-slate-500 text-5xl font-bold font-mono tabular-nums">{clock}</p>
      )}
    </div>
  )
}

function useClock() {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const t = setInterval(() =>
      setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    , 10000)
    return () => clearInterval(t)
  }, [])
  return clock
}

// ─── Bo3 views ────────────────────────────────────────────────────────────────

function DayStatsView({ todayMatches, nameMap }) {
  const clock = useClock()

  const playerStats = {}
  for (const m of todayMatches) {
    if (!m.winner_id) continue
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
    for (const id of [m.winner_id, loserId]) {
      if (!playerStats[id]) playerStats[id] = { wins: 0, losses: 0 }
    }
    playerStats[m.winner_id].wins++
    playerStats[loserId].losses++
  }
  const rows = Object.entries(playerStats)
    .map(([id, s]) => ({ id, ...s, played: s.wins + s.losses }))
    .sort((a, b) => b.wins - a.wins || b.played - a.played)

  return (
    <div className="h-full p-16 flex flex-col">
      <ViewHeader title="Today's Matches" subtitle="Daily Stats" clock={clock} />
      <div className="grid grid-cols-4 gap-6 flex-1">
        <div className="card p-8 flex flex-col">
          <p className="text-slate-500 text-base uppercase tracking-widest font-semibold">Total Played</p>
          <p className="text-8xl font-bold text-slate-100 mt-auto tabular-nums">{todayMatches.length}</p>
        </div>
        {rows.slice(0, 3).map(p => (
          <div key={p.id} className="card p-8 flex flex-col">
            <p className="text-slate-500 text-base uppercase tracking-widest font-semibold truncate">{nameMap[p.id] ?? p.id}</p>
            <div className="mt-auto">
              <p className="text-8xl font-bold text-pool-accent tabular-nums">
                {p.wins}<span className="text-slate-500 text-5xl">W</span>
              </p>
              <p className="text-slate-500 text-2xl mt-1">{p.losses}L · {p.played} played</p>
            </div>
          </div>
        ))}
      </div>
      {rows.length > 3 && (
        <div className="grid grid-cols-4 gap-6 mt-6">
          {rows.slice(3).map(p => (
            <div key={p.id} className="card p-6 flex flex-col">
              <p className="text-slate-500 text-sm uppercase tracking-widest font-semibold truncate">{nameMap[p.id] ?? p.id}</p>
              <div className="mt-auto">
                <p className="text-5xl font-bold text-pool-accent tabular-nums">
                  {p.wins}<span className="text-slate-500 text-3xl">W</span>
                </p>
                <p className="text-slate-500 text-lg">{p.losses}L</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {todayMatches.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-700 text-3xl">No matches recorded today yet</p>
        </div>
      )}
    </div>
  )
}

function RecentResultsView({ matches, nameMap }) {
  const clock = useClock()
  const recent = matches.slice(0, 10)

  return (
    <div className="h-full p-16 flex flex-col">
      <ViewHeader title="Recent Results" subtitle="Latest Matches" clock={clock} />
      <div className="grid grid-cols-2 gap-4 flex-1 content-start">
        {recent.map(m => {
          const { leftId, rightId, leftWon, rightWon, leftScore, rightScore, isBo3, gameSeq } = getMatchDisplay(m, nameMap)
          const time = new Date(m.played_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={m.id} className="card px-8 py-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="badge-green px-3 py-1 text-sm font-bold">{nameMap[m.winner_id] ?? '—'} wins</span>
                <span className="text-slate-600 text-lg font-mono">{time}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                  {isBo3 && <span className={`text-3xl font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                  <p className={`text-2xl font-bold truncate text-right ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameMap[leftId] ?? '—'}</p>
                </div>
                <span className="text-slate-600 text-xl shrink-0">vs</span>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <p className={`text-2xl font-bold truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameMap[rightId] ?? '—'}</p>
                  {isBo3 && <span className={`text-3xl font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-base">
                <span>{isBo3 ? 'Best of 3' : 'Single game'}</span>
                {isBo3 && gameSeq && <><span>·</span><span>{gameSeq}</span></>}
              </div>
            </div>
          )
        })}
        {recent.length === 0 && (
          <div className="col-span-2 flex items-center justify-center h-full">
            <p className="text-slate-700 text-3xl">No recent matches</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DayLeaderboardView({ todayMatches, nameMap }) {
  const clock = useClock()

  const playerStats = {}
  for (const m of todayMatches) {
    if (!m.winner_id) continue
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
    for (const id of [m.winner_id, loserId]) {
      if (!playerStats[id]) playerStats[id] = { wins: 0, losses: 0 }
    }
    playerStats[m.winner_id].wins++
    playerStats[loserId].losses++
  }
  const rows = Object.entries(playerStats)
    .map(([id, s]) => ({ id, ...s, played: s.wins + s.losses }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

  return (
    <div className="h-full p-16 flex flex-col">
      <ViewHeader title="Today's Standings" subtitle="Day Leaderboard" clock={clock} />
      <div className="card overflow-hidden flex-1">
        <table className="w-full h-full">
          <thead>
            <tr className="border-b border-pool-border">
              <th className="pl-10 py-6 text-left text-slate-500 text-lg font-semibold uppercase tracking-widest w-16">#</th>
              <th className="pl-6 py-6 text-left text-slate-500 text-lg font-semibold uppercase tracking-widest">Player</th>
              <th className="py-6 text-center text-slate-500 text-lg font-semibold uppercase tracking-widest w-32">Played</th>
              <th className="py-6 text-center text-slate-500 text-lg font-semibold uppercase tracking-widest w-32">Won</th>
              <th className="pr-10 py-6 text-center text-slate-500 text-lg font-semibold uppercase tracking-widest w-32">Lost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-pool-border/30 last:border-0">
                <td className="pl-10 py-6 text-slate-600 font-mono text-2xl">{i + 1}</td>
                <td className="pl-6 py-6 text-4xl font-bold text-slate-100">{nameMap[r.id] ?? r.id}</td>
                <td className="py-6 text-center text-3xl text-slate-400 tabular-nums">{r.played}</td>
                <td className="py-6 text-center text-3xl win-text font-bold tabular-nums">{r.wins}</td>
                <td className="pr-10 py-6 text-center text-3xl loss-text tabular-nums">{r.losses}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-20 text-slate-700 text-3xl">No matches today yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SeasonLeaderboardView({ standings, activeSeason }) {
  const clock = useClock()

  return (
    <div className="h-full p-16 flex flex-col">
      <ViewHeader title={activeSeason?.name ?? 'Leaderboard'} subtitle="Season Standings" clock={clock} />
      <div className="card overflow-hidden flex-1">
        <table className="w-full h-full">
          <thead>
            <tr className="border-b border-pool-border">
              <th className="pl-10 py-6 text-left text-slate-500 text-lg font-semibold uppercase tracking-widest w-16">#</th>
              <th className="pl-6 py-6 text-left text-slate-500 text-lg font-semibold uppercase tracking-widest">Player</th>
              <th className="py-6 text-center text-slate-500 text-lg font-semibold uppercase tracking-widest w-32">W</th>
              <th className="py-6 text-center text-slate-500 text-lg font-semibold uppercase tracking-widest w-32">L</th>
              <th className="pr-10 py-6 text-right text-slate-500 text-lg font-semibold uppercase tracking-widest w-40">Rating</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.player_id} className="border-b border-pool-border/30 last:border-0">
                <td className="pl-10 py-6 text-slate-600 font-mono text-2xl">
                  {!s.isProvisional && i === 0 ? '👑' : i + 1}
                </td>
                <td className="pl-6 py-6 text-4xl font-bold text-slate-100">{s.player_name}</td>
                <td className="py-6 text-center text-3xl win-text font-bold tabular-nums">{s.wins}</td>
                <td className="py-6 text-center text-3xl loss-text tabular-nums">{s.losses}</td>
                <td className="pr-10 py-6 text-right font-mono text-3xl tabular-nums">
                  {s.isProvisional
                    ? <span className="text-slate-600">~{s.rating}</span>
                    : <span className="text-slate-100">{s.rating}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tournament views ─────────────────────────────────────────────────────────

function TournamentStructureView({ tournament, matches, rounds, nameMap }) {
  const clock = useClock()
  const isBracket = tournament.format !== 'round_robin'
  const parts = tournament.tournament_participants ?? []
  const participantIds = parts.map(p => p.player_id)
  const standings = computeStandings(participantIds, matches)
  const hasPositions = parts.some(p => p.final_position !== null)
  const winner = parts.find(p => p.final_position === 1)

  const sortedParts = [...parts].sort((a, b) => {
    if (hasPositions) return (a.final_position ?? 99) - (b.final_position ?? 99)
    const wa = standings[a.player_id]?.wins ?? 0
    const wb = standings[b.player_id]?.wins ?? 0
    return wb - wa || (standings[a.player_id]?.losses ?? 0) - (standings[b.player_id]?.losses ?? 0)
  })

  const roundGroups = []
  if (isBracket && rounds.length) {
    const maxR = Math.max(...rounds.map(r => r.round_number))
    for (let r = 1; r <= maxR; r++) roundGroups.push(rounds.filter(b => b.round_number === r))
  }

  return (
    <div className="h-full p-16 flex flex-col">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <p className="text-pool-accent text-sm font-bold tracking-widest uppercase mb-1">
            {isBracket ? 'Single Elimination' : 'Round Robin'}
          </p>
          <h2 className="text-5xl font-bold text-slate-100">{tournament.name}</h2>
        </div>
        <div className="flex items-center gap-6">
          {winner ? (
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-900/20 border border-amber-700/40">
              <span className="text-amber-400 text-2xl">🏆</span>
              <span className="text-amber-300 text-2xl font-bold">{nameMap[winner.player_id] ?? ''}</span>
            </div>
          ) : (
            <span className="badge-gray text-xl px-5 py-2">In Progress</span>
          )}
          <p className="text-slate-500 text-5xl font-bold font-mono tabular-nums">{clock}</p>
        </div>
      </div>

      {isBracket && roundGroups.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="transform scale-150 origin-top-left" style={{ width: '66.67%' }}>
            <BracketView rounds={roundGroups} nameOf={pid => nameMap[pid] ?? ''} readOnly />
          </div>
        </div>
      )}

      {!isBracket && (
        <div className="card overflow-hidden flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pool-border">
                <th className="pl-10 py-6 text-left text-slate-500 text-lg uppercase tracking-widest w-16">#</th>
                <th className="pl-6 py-6 text-left text-slate-500 text-lg uppercase tracking-widest">Player</th>
                <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-32">W</th>
                <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-32">L</th>
                <th className="pr-10 py-6 text-right text-slate-500 text-lg uppercase tracking-widest w-32">Win%</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((p, i) => {
                const s = standings[p.player_id]
                const total = (s?.wins ?? 0) + (s?.losses ?? 0)
                const pos = hasPositions ? (p.final_position ?? i + 1) : i + 1
                return (
                  <tr key={p.player_id} className="border-b border-pool-border/30 last:border-0">
                    <td className="pl-10 py-6 text-slate-600 font-mono text-2xl">{pos}</td>
                    <td className={`pl-6 py-6 text-4xl font-bold ${pos === 1 ? 'text-amber-300' : 'text-slate-100'}`}>
                      {nameMap[p.player_id] ?? ''}
                    </td>
                    <td className="py-6 text-center text-3xl win-text font-bold tabular-nums">{s?.wins ?? 0}</td>
                    <td className="py-6 text-center text-3xl loss-text tabular-nums">{s?.losses ?? 0}</td>
                    <td className="pr-10 py-6 text-right text-slate-400 font-mono text-3xl tabular-nums">
                      {total > 0 ? `${Math.round((s.wins / total) * 100)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TournamentResultsView({ tournament, matches, rounds, nameMap }) {
  const clock = useClock()
  const isBracket = tournament.format !== 'round_robin'
  const totalRounds = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) : 0

  const getStage = (m) => {
    if (!isBracket) return 'Round Robin'
    const round = rounds.find(r =>
      (r.player1_id === m.player1_id && r.player2_id === m.player2_id) ||
      (r.player1_id === m.player2_id && r.player2_id === m.player1_id)
    )
    return round ? getBracketRoundName(round.round_number, totalRounds) : ''
  }

  const recent = [...matches]
    .filter(m => m.winner_id)
    .sort((a, b) => b.played_at.localeCompare(a.played_at))
    .slice(0, 10)

  return (
    <div className="h-full p-16 flex flex-col">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <p className="text-pool-accent text-sm font-bold tracking-widest uppercase mb-1">{tournament.name}</p>
          <h2 className="text-5xl font-bold text-slate-100">Recent Results</h2>
        </div>
        <p className="text-slate-500 text-5xl font-bold font-mono tabular-nums">{clock}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 content-start">
        {recent.map(m => {
          const { leftId, rightId, leftWon, rightWon, leftScore, rightScore, isBo3, gameSeq } = getMatchDisplay(m, nameMap)
          const stage = getStage(m)
          const time = new Date(m.played_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={m.id} className="card px-8 py-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {stage && <span className="text-slate-500 text-sm font-bold uppercase tracking-widest">{stage}</span>}
                  <span className="badge-green px-3 py-1 text-sm font-bold">{nameMap[m.winner_id] ?? '—'} wins</span>
                </div>
                <span className="text-slate-600 text-lg font-mono">{time}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                  {isBo3 && <span className={`text-3xl font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                  <p className={`text-2xl font-bold truncate text-right ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameMap[leftId] ?? '—'}</p>
                </div>
                <span className="text-slate-600 text-xl shrink-0">vs</span>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <p className={`text-2xl font-bold truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{nameMap[rightId] ?? '—'}</p>
                  {isBo3 && <span className={`text-3xl font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-base">
                <span>{isBo3 ? 'Best of 3' : 'Single game'}</span>
                {isBo3 && gameSeq && <><span>·</span><span>{gameSeq}</span></>}
              </div>
            </div>
          )
        })}
        {recent.length === 0 && (
          <div className="col-span-2 flex items-center justify-center">
            <p className="text-slate-700 text-3xl">No results yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TournamentStandingsView({ tournament, matches, nameMap }) {
  const clock = useClock()
  const parts = tournament.tournament_participants ?? []
  const participantIds = parts.map(p => p.player_id)
  const standings = computeStandings(participantIds, matches)
  const hasPositions = parts.some(p => p.final_position !== null)

  const rows = [...parts].sort((a, b) => {
    if (hasPositions) return (a.final_position ?? 99) - (b.final_position ?? 99)
    return (standings[b.player_id]?.wins ?? 0) - (standings[a.player_id]?.wins ?? 0)
  })

  return (
    <div className="h-full p-16 flex flex-col">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <p className="text-pool-accent text-sm font-bold tracking-widest uppercase mb-1">{tournament.name}</p>
          <h2 className="text-5xl font-bold text-slate-100">Standings</h2>
        </div>
        <p className="text-slate-500 text-5xl font-bold font-mono tabular-nums">{clock}</p>
      </div>
      <div className="card overflow-hidden flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pool-border">
              <th className="pl-10 py-6 text-left text-slate-500 text-lg uppercase tracking-widest w-16">#</th>
              <th className="pl-6 py-6 text-left text-slate-500 text-lg uppercase tracking-widest">Player</th>
              <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-32">Played</th>
              <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-32">Won</th>
              <th className="pr-10 py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-32">Lost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const s = standings[p.player_id]
              const played = (s?.wins ?? 0) + (s?.losses ?? 0)
              const pos = hasPositions ? (p.final_position ?? i + 1) : i + 1
              return (
                <tr key={p.player_id} className="border-b border-pool-border/30 last:border-0">
                  <td className="pl-10 py-6 text-slate-600 font-mono text-2xl">{pos}</td>
                  <td className={`pl-6 py-6 text-4xl font-bold ${pos === 1 ? 'text-amber-300' : 'text-slate-100'}`}>
                    {nameMap[p.player_id] ?? ''}
                  </td>
                  <td className="py-6 text-center text-3xl text-slate-400 tabular-nums">{played}</td>
                  <td className="py-6 text-center text-3xl win-text font-bold tabular-nums">{s?.wins ?? 0}</td>
                  <td className="pr-10 py-6 text-center text-3xl loss-text tabular-nums">{s?.losses ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TournamentBreakdownView({ tournament, matches, nameMap }) {
  const clock = useClock()
  const parts = tournament.tournament_participants ?? []
  const participantIds = parts.map(p => p.player_id)
  const standings = computeStandings(participantIds, matches)

  const rows = [...parts]
    .map(p => {
      const s = standings[p.player_id] ?? { wins: 0, losses: 0 }
      const played = s.wins + s.losses
      return { id: p.player_id, ...s, played, winPct: played > 0 ? Math.round((s.wins / played) * 100) : null }
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

  return (
    <div className="h-full p-16 flex flex-col">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <p className="text-pool-accent text-sm font-bold tracking-widest uppercase mb-1">{tournament.name}</p>
          <h2 className="text-5xl font-bold text-slate-100">Player Breakdown</h2>
        </div>
        <p className="text-slate-500 text-5xl font-bold font-mono tabular-nums">{clock}</p>
      </div>
      <div className="card overflow-hidden flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pool-border">
              <th className="pl-10 py-6 text-left text-slate-500 text-lg uppercase tracking-widest">Player</th>
              <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-40">Played</th>
              <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-40">Won</th>
              <th className="py-6 text-center text-slate-500 text-lg uppercase tracking-widest w-40">Lost</th>
              <th className="pr-10 py-6 text-right text-slate-500 text-lg uppercase tracking-widest w-40">Win%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-pool-border/30 last:border-0">
                <td className="pl-10 py-6 text-4xl font-bold text-slate-100">{nameMap[r.id] ?? ''}</td>
                <td className="py-6 text-center text-3xl text-slate-400 tabular-nums">{r.played}</td>
                <td className="py-6 text-center text-3xl win-text font-bold tabular-nums">{r.wins}</td>
                <td className="py-6 text-center text-3xl loss-text tabular-nums">{r.losses}</td>
                <td className="pr-10 py-6 text-right font-mono text-3xl text-slate-300 tabular-nums">
                  {r.winPct !== null ? `${r.winPct}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [currentView, setCurrentView] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)

  const loadData = useCallback(async () => {
    const { data: cfg } = await supabase
      .from('dashboard_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (!cfg) return

    if (cfg.mode === 'tournament' && cfg.tournament_id) {
      const [{ data: tournament }, { data: matches }, { data: rounds }] = await Promise.all([
        supabase.from('tournaments').select(`
          id, name, format, date,
          tournament_participants(player_id, final_position, player:player_id(id, name, avatar_url))
        `).eq('id', cfg.tournament_id).single(),
        supabase.from('matches')
          .select('id, played_at, format, player1_id, player2_id, winner_id, games(game_number, winner_id)')
          .eq('tournament_id', cfg.tournament_id)
          .order('played_at').order('created_at'),
        supabase.from('tournament_rounds')
          .select('*')
          .eq('tournament_id', cfg.tournament_id)
          .order('round_number').order('position'),
      ])

      const allPlayers = (tournament?.tournament_participants ?? []).map(p => p.player).filter(Boolean)
      setData({ mode: 'tournament', tournament, matches: matches ?? [], rounds: rounds ?? [], nameMap: buildDisplayNames(allPlayers) })
    } else {
      const todayStr = new Date().toISOString().slice(0, 10)
      const [{ data: season }, { data: allMatches }, { data: players }] = await Promise.all([
        supabase.from('seasons').select('id, name, start_date, end_date').eq('is_active', true).maybeSingle(),
        supabase.from('matches')
          .select('id, played_at, format, player1_id, player2_id, winner_id, tournament_id, games(game_number, winner_id)')
          .not('winner_id', 'is', null)
          .order('played_at', { ascending: false }),
        supabase.from('players').select('id, name').eq('active', true),
      ])

      const nonTournament = (allMatches ?? []).filter(m => !m.tournament_id)
      const todayMatches = nonTournament.filter(m => m.played_at.slice(0, 10) === todayStr)

      let seasonMatches = nonTournament
      if (season) {
        seasonMatches = nonTournament.filter(m =>
          m.played_at >= season.start_date && m.played_at <= season.end_date + 'T23:59:59'
        )
      }

      const eloRatings = computeEloRatings([...seasonMatches].sort((a, b) => a.played_at.localeCompare(b.played_at)))
      const standings = buildEloStandings(eloRatings, players ?? [])
      const nameMap = buildDisplayNames(players ?? [])

      setData({ mode: 'bo3', todayMatches, recentMatches: nonTournament.slice(0, 10), standings, activeSeason: season, nameMap })
    }

    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, REFRESH_MS)
    return () => clearInterval(t)
  }, [loadData])

  useEffect(() => {
    const t = setInterval(() => setCurrentView(v => (v + 1) % 4), SLIDE_MS)
    return () => clearInterval(t)
  }, [])

  if (!data) {
    return (
      <div className="w-screen h-screen bg-pool-surface flex items-center justify-center">
        <p className="text-slate-600 text-3xl">Loading dashboard…</p>
      </div>
    )
  }

  const isTournamentMisconfig = data.mode === 'tournament' && !data.tournament

  const bo3Views = data.mode === 'bo3' ? [
    <DayStatsView key="day-stats" todayMatches={data.todayMatches} nameMap={data.nameMap} />,
    <RecentResultsView key="recent" matches={data.recentMatches} nameMap={data.nameMap} />,
    <DayLeaderboardView key="day-lb" todayMatches={data.todayMatches} nameMap={data.nameMap} />,
    <SeasonLeaderboardView key="season-lb" standings={data.standings} activeSeason={data.activeSeason} />,
  ] : null

  const tournamentViews = data.mode === 'tournament' && data.tournament ? [
    <TournamentStructureView key="t-structure" tournament={data.tournament} matches={data.matches} rounds={data.rounds} nameMap={data.nameMap} />,
    <TournamentResultsView key="t-results" tournament={data.tournament} matches={data.matches} rounds={data.rounds} nameMap={data.nameMap} />,
    <TournamentStandingsView key="t-standings" tournament={data.tournament} matches={data.matches} nameMap={data.nameMap} />,
    <TournamentBreakdownView key="t-breakdown" tournament={data.tournament} matches={data.matches} nameMap={data.nameMap} />,
  ] : null

  const views = bo3Views ?? tournamentViews ?? []

  const viewNames = data.mode === 'bo3'
    ? ["Today's Stats", "Recent Results", "Day Standings", "Season Leaderboard"]
    : ["Bracket / Draw", "Recent Results", "Standings", "Player Breakdown"]

  const isTest = import.meta.env.VITE_ENV_NAME === 'test'

  return (
    <div className="w-screen h-screen bg-pool-surface overflow-hidden relative hidden lg:flex flex-col">
      {isTest && (
        <div className="bg-orange-500 text-white text-xs font-bold text-center py-1 tracking-widest uppercase shrink-0">
          Development Environment
        </div>
      )}
      {isTournamentMisconfig ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-600 text-3xl">No tournament selected — configure in Admin Dashboard</p>
        </div>
      ) : (
        <>
          {/* Slide carousel */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentView * 25}%)`, width: '400%' }}
            >
              {views.map((view, i) => (
                <div key={i} className="h-full" style={{ width: '25%' }}>
                  {view}
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-pool-border overflow-hidden shrink-0">
            <div
              key={currentView}
              className="h-full bg-pool-accent"
              style={{ animation: `dashboardProgress ${SLIDE_MS}ms linear forwards` }}
            />
          </div>

          {/* Bottom bar */}
          <div className="bg-pool-card border-t border-pool-border px-10 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-8">
              {viewNames.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentView(i)}
                  className={`text-sm font-semibold tracking-wide uppercase transition-colors ${i === currentView ? 'text-pool-accent' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-slate-700 text-xs">
              {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Refreshing…'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
