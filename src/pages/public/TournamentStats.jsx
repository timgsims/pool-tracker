import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Avatar from '../../components/ui/Avatar'

export default function TournamentStats() {
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [tournamentMatches, setTournamentMatches] = useState([])
  const [participants, setParticipants] = useState([])
  const [nameMap, setNameMap] = useState({})

  useEffect(() => {
    async function load() {
      const [
        { data: p },
        { data: t },
        { data: m },
        { data: parts },
      ] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url').eq('active', true),
        supabase.from('tournaments').select('id, name, date, format').order('date', { ascending: false }),
        supabase
          .from('matches')
          .select('id, played_at, player1_id, player2_id, winner_id, tournament_id')
          .not('tournament_id', 'is', null)
          .not('winner_id', 'is', null),
        supabase.from('tournament_participants').select('tournament_id, player_id, final_position'),
      ])

      setPlayers(p ?? [])
      setTournaments(t ?? [])
      setTournamentMatches(m ?? [])
      setParticipants(parts ?? [])
      setNameMap(buildDisplayNames(p ?? []))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''

  const playerList = players ?? []
  const matchList = tournamentMatches ?? []
  const partList = participants ?? []

  // Overall tournament record per player
  const playerRecords = playerList
    .map(p => {
      const entered = new Set(partList.filter(pa => pa.player_id === p.id).map(pa => pa.tournament_id)).size
      if (entered === 0) return null
      const pm = matchList.filter(m => m.player1_id === p.id || m.player2_id === p.id)
      const wins = pm.filter(m => m.winner_id === p.id).length
      const losses = pm.length - wins
      return { ...p, entered, wins, losses, total: pm.length, winRate: pm.length > 0 ? wins / pm.length : null }
    })
    .filter(Boolean)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.wins - a.wins)

  // Per-tournament standings
  const tournamentResults = tournaments.map(t => {
    const tMatches = matchList.filter(m => m.tournament_id === t.id)
    const tParts = partList.filter(pa => pa.tournament_id === t.id)

    // Complete only when every participant has a final_position assigned by the admin
    const isComplete = tParts.length > 0 && tParts.every(tp => tp.final_position != null)
    const winnerId = isComplete
      ? (tParts.find(tp => tp.final_position === 1)?.player_id ?? null)
      : null

    // Standings: per-participant wins/losses in this tournament
    const standings = tParts
      .map(tp => {
        const pm = tMatches.filter(m => m.player1_id === tp.player_id || m.player2_id === tp.player_id)
        const w = pm.filter(m => m.winner_id === tp.player_id).length
        const l = pm.length - w
        return { player_id: tp.player_id, wins: w, losses: l, played: pm.length }
      })
      .filter(s => s.played > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

    return { ...t, winnerId, isComplete, standings }
  }).filter(t => t.standings.length > 0)

  const hasData = playerRecords.length > 0

  return (
    <div className="space-y-8">
      <div>
        <p className="section-header">Competitive Play</p>
        <h1 className="page-title">Tournament Stats</h1>
      </div>

      {!hasData ? (
        <div className="card p-8 text-center text-slate-600">No tournament match data yet.</div>
      ) : (
        <>
          {/* Overall tournament records */}
          <div>
            <p className="section-header">Tournament Records</p>
            <p className="text-slate-600 text-xs -mt-2 mb-3">Wins and losses from tournament matches only</p>
            <div className="card overflow-x-auto">
              <table className="table-base min-w-full">
                <colgroup>
                  <col />
                  <col className="w-24" />
                  <col className="w-12" />
                  <col className="w-12" />
                  <col className="w-16" />
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="pl-5 text-left">Player</th>
                    <th className="text-center">Entered</th>
                    <th className="text-center">W</th>
                    <th className="text-center">L</th>
                    <th className="text-center hidden sm:table-cell">Played</th>
                    <th className="text-right pr-5">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRecords.map(p => (
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
                      <td className="text-center text-slate-500 tabular-nums text-sm">{p.entered}</td>
                      <td className="text-center win-text tabular-nums">{p.wins}</td>
                      <td className="text-center loss-text tabular-nums">{p.losses}</td>
                      <td className="text-center text-slate-500 tabular-nums text-sm hidden sm:table-cell">{p.total}</td>
                      <td className="text-right pr-5 font-mono text-sm tabular-nums text-slate-300">
                        {p.winRate != null ? `${(p.winRate * 100).toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-tournament results */}
          <div>
            <p className="section-header">Tournament Results</p>
            <div className="space-y-4">
              {tournamentResults.map(t => (
                <div key={t.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{t.name}</p>
                      <p className="text-slate-600 text-xs mt-0.5">
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {t.format === 'round_robin' ? 'Round Robin' : 'Bracket'}
                      </p>
                    </div>
                    {t.winnerId ? (
                      <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/40">
                        <span className="text-amber-400 text-sm">🏆</span>
                        <span className="text-amber-300 text-sm font-semibold">{n(t.winnerId)}</span>
                      </div>
                    ) : (
                      <span className="badge-gray shrink-0">In Progress</span>
                    )}
                  </div>

                  {t.standings.length > 0 && (
                    <div className="divide-y divide-pool-border/40">
                      {t.standings.map((s, i) => {
                        const total = s.wins + s.losses
                        const pct = total > 0 ? Math.round((s.wins / total) * 100) : null
                        return (
                          <div key={s.player_id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 text-xs font-mono w-4">{i + 1}</span>
                              <Link
                                to={`/player/${s.player_id}`}
                                className="text-sm font-medium text-slate-300 hover:text-pool-accent transition-colors"
                              >
                                {n(s.player_id)}
                              </Link>
                              {s.player_id === t.winnerId && (
                                <span className="text-amber-400 text-xs">🏆</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-mono tabular-nums">
                                <span className="win-text">{s.wins}W</span>
                                <span className="text-slate-600 mx-1">–</span>
                                <span className="loss-text">{s.losses}L</span>
                              </span>
                              {pct != null && (
                                <span className="text-slate-500 font-mono text-xs tabular-nums w-10 text-right">{pct}%</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
