import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildDisplayNames } from '../../lib/nameUtils'
import Avatar from '../../components/ui/Avatar'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function Players() {
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({})
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('id, name, avatar_url').eq('active', true).order('name'),
      supabase.from('player_season_stats').select('player_id, wins, losses, matches_played, win_pct'),
    ]).then(([{ data: p }, { data: s }]) => {
      const playerList = p ?? []
      const statsMap = {}
      for (const row of (s ?? [])) {
        if (!statsMap[row.player_id]) statsMap[row.player_id] = { wins: 0, losses: 0, played: 0 }
        statsMap[row.player_id].wins += row.wins ?? 0
        statsMap[row.player_id].losses += row.losses ?? 0
        statsMap[row.player_id].played += row.matches_played ?? 0
      }
      setPlayers(playerList)
      setStats(statsMap)
      setNameMap(buildDisplayNames(playerList))
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  const sorted = [...players].sort((a, b) => {
    const pa = stats[a.id]?.played ?? 0
    const pb = stats[b.id]?.played ?? 0
    if (pb !== pa) return pb - pa
    return a.name.localeCompare(b.name)
  })

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
          </colgroup>
          <thead>
            <tr>
              <th className="pl-5 text-left">Player</th>
              <th className="text-center">W</th>
              <th className="text-center">L</th>
              <th className="text-right pr-5">Win%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const s = stats[p.id]
              const played = s?.played ?? 0
              const wins = s?.wins ?? 0
              const losses = s?.losses ?? 0
              const winPct = played > 0 ? Math.round((wins / played) * 100) : null
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
                  <td className="text-right pr-5 text-slate-300 tabular-nums text-sm">
                    {winPct !== null ? `${winPct}%` : <span className="text-slate-700">—</span>}
                  </td>
                </tr>
              )
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-600">No players yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
