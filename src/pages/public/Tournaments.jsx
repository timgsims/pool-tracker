import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

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

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [matchesByTournament, setMatchesByTournament] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('tournaments')
        .select(`
          id, name, date, format,
          tournament_participants(
            player_id, final_position,
            player:player_id(id, name)
          )
        `)
        .order('date', { ascending: false }),
      supabase
        .from('matches')
        .select('id, tournament_id, player1_id, player2_id, winner_id')
        .not('tournament_id', 'is', null),
    ]).then(([{ data: t }, { data: m }]) => {
      setTournaments(t ?? [])
      const byId = {}
      for (const match of (m ?? [])) {
        if (!byId[match.tournament_id]) byId[match.tournament_id] = []
        byId[match.tournament_id].push(match)
      }
      setMatchesByTournament(byId)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">History</p>
        <h1 className="page-title">Tournaments</h1>
      </div>

      {tournaments.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No tournaments yet"
            message="Tournament results will appear here once added by the admin."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map(t => {
            const parts = [...(t.tournament_participants ?? [])]
            const tMatches = matchesByTournament[t.id] ?? []
            const hasPositions = parts.some(p => p.final_position !== null)
            const winner = parts.find(p => p.final_position === 1)

            const participantIds = parts.map(p => p.player_id)
            const standings = computeStandings(participantIds, tMatches)

            // If final positions are set, sort by them; else sort by standings
            const sortedParts = hasPositions
              ? [...parts].sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99))
              : [...parts].sort((a, b) => {
                  const wa = standings[a.player_id]?.wins ?? 0
                  const wb = standings[b.player_id]?.wins ?? 0
                  if (wb !== wa) return wb - wa
                  return (standings[a.player_id]?.losses ?? 0) - (standings[b.player_id]?.losses ?? 0)
                })

            return (
              <div key={t.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-slate-100 text-lg">{t.name}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{t.format.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{parts.length} players</span>
                      {tMatches.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{tMatches.length} matches</span>
                        </>
                      )}
                    </div>
                  </div>
                  {winner && (
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-slate-600 mb-0.5">Winner</p>
                      <p className="font-bold text-pool-accent">🏆 {winner.player?.name}</p>
                    </div>
                  )}
                </div>

                {sortedParts.length > 0 && (
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
                                    {p.player?.name}
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
                              {p.player?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
