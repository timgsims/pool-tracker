import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import { computeEloRatings } from '../../lib/eloUtils'
import Avatar from '../../components/ui/Avatar'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function Players() {
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({})
  const [eloRatings, setEloRatings] = useState({})
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('id, name, avatar_url').eq('active', true).order('name'),
      supabase.from('player_season_stats').select('player_id, wins, losses, matches_played, win_pct'),
      supabase.from('seasons').select('id, start_date, end_date').eq('is_active', true).maybeSingle(),
      supabase.from('matches').select('id, played_at, player1_id, player2_id, winner_id')
        .is('tournament_id', null).not('winner_id', 'is', null).order('played_at', { ascending: true }),
    ]).then(([{ data: p }, { data: s }, { data: season }, { data: allMatches }]) => {
      const playerList = p ?? []
      const statsMap = {}
      for (const row of (s ?? [])) {
        if (!statsMap[row.player_id]) statsMap[row.player_id] = { wins: 0, losses: 0, played: 0 }
        statsMap[row.player_id].wins += row.wins ?? 0
        statsMap[row.player_id].losses += row.losses ?? 0
        statsMap[row.player_id].played += row.matches_played ?? 0
      }
      const seasonMatches = season
        ? (allMatches ?? []).filter(m => m.played_at >= season.start_date && m.played_at <= season.end_date + 'T23:59:59')
        : []
      setPlayers(playerList)
      setStats(statsMap)
      setEloRatings(computeEloRatings(seasonMatches))
      setNameMap(buildDisplayNames(playerList))
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">Directory</p>
        <h1 className="page-title">Players</h1>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <colgroup>
            <col />
            <col className="w-14" />
            <col className="w-14" />
            <col className="w-16" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">Player</th>
              <th className="text-center">W</th>
              <th className="text-center">L</th>
              <th className="text-center">Win%</th>
              <th className="text-right pr-5">Rating</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const s = stats[p.id]
              const played = s?.played ?? 0
              const wins = s?.wins ?? 0
              const losses = s?.losses ?? 0
              const winPct = played > 0 ? Math.round((wins / played) * 100) : null
              const elo = eloRatings[p.id]
              return (
                <tr key={p.id}>
                  <td className="pl-5">
                    <Link
                      to={`/player/${p.id}`}
                      className="flex items-center gap-3 font-semibold text-slate-100 hover:text-pool-accent transition-colors"
                    >
                      <Avatar name={p.name} src={p.avatar_url} size="sm" />
                      {nameMap[p.id] ?? p.name}
                    </Link>
                  </td>
                  <td className="text-center win-text tabular-nums text-sm">
                    {played > 0 ? wins : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-center loss-text tabular-nums text-sm">
                    {played > 0 ? losses : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-center text-slate-300 tabular-nums text-sm">
                    {winPct !== null ? `${winPct}%` : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="text-right pr-5 font-mono text-sm tabular-nums">
                    {elo
                      ? elo.isProvisional
                        ? <span className="text-slate-600">~{elo.rating}</span>
                        : <span className="text-slate-100">{elo.rating}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                </tr>
              )
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-600">No players yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
