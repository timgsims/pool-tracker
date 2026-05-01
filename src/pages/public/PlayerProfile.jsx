import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatDateShort } from '../../lib/dateUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatCard from '../../components/ui/StatCard'

const CURRENT_YEAR = new Date().getFullYear()

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function computeStreak(matches, playerId) {
  if (!matches.length) return { type: null, count: 0 }
  const first = matches[0]
  if (!first.winner) return { type: null, count: 0 }
  const streakType = first.winner.id === playerId ? 'W' : 'L'
  let count = 0
  for (const m of matches) {
    if (!m.winner) break
    const won = m.winner.id === playerId
    if ((streakType === 'W') === won) count++
    else break
  }
  return { type: streakType, count }
}

function computeComebacks(matches, playerId) {
  let count = 0
  for (const m of matches) {
    if (m.format !== 'best_of_3') continue
    if (!m.winner || m.winner.id !== playerId) continue
    if (!m.games || m.games.length < 3) continue
    const sorted = [...m.games].sort((a, b) => a.game_number - b.game_number)
    if (sorted[0]?.winner_id !== playerId) count++
  }
  return count
}

function buildMonthlyForm(matches, playerId) {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      wins: 0,
      losses: 0,
    })
  }
  for (const m of matches) {
    if (!m.winner) continue
    const d = new Date(m.played_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const month = months.find(mo => mo.key === key)
    if (!month) continue
    if (m.winner.id === playerId) month.wins++
    else month.losses++
  }
  return months
}

function computeH2H(matches, playerId) {
  const opponents = {}
  for (const m of matches) {
    if (!m.winner) continue
    const opp = m.player1?.id === playerId ? m.player2 : m.player1
    if (!opp) continue
    if (!opponents[opp.id]) opponents[opp.id] = { id: opp.id, name: opp.name, wins: 0, losses: 0 }
    if (m.winner.id === playerId) opponents[opp.id].wins++
    else opponents[opp.id].losses++
  }
  return Object.values(opponents).sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-pool-elevated border border-pool-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }} className="leading-5">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlayerProfile() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState(null)
  const [allMatches, setAllMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Derived stats computed from allMatches
  const [streak, setStreak] = useState({ type: null, count: 0 })
  const [comebacks, setComebacks] = useState(0)
  const [monthlyForm, setMonthlyForm] = useState([])
  const [h2h, setH2H] = useState([])

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: s }, { data: m }] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),

        supabase
          .from('player_season_stats')
          .select('*')
          .eq('player_id', id)
          .eq('season', CURRENT_YEAR)
          .single(),

        supabase
          .from('matches')
          .select(`
            id, played_at, format,
            player1:player1_id(id, name),
            player2:player2_id(id, name),
            winner:winner_id(id, name),
            games(game_number, winner_id)
          `)
          .or(`player1_id.eq.${id},player2_id.eq.${id}`)
          .order('played_at', { ascending: false }),
      ])

      if (!p) { setNotFound(true); setLoading(false); return }

      const matches = m ?? []
      setPlayer(p)
      setStats(s)
      setAllMatches(matches)
      setStreak(computeStreak(matches, id))
      setComebacks(computeComebacks(matches, id))
      setMonthlyForm(buildMonthlyForm(matches, id))
      setH2H(computeH2H(matches, id))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <LoadingSpinner />
  if (notFound) return (
    <div className="text-center py-16">
      <p className="text-slate-500">Player not found.</p>
      <Link to="/" className="btn-ghost mt-4 inline-block">← Leaderboard</Link>
    </div>
  )

  const recentMatches = allMatches.slice(0, 10)
  const hasMonthlyActivity = monthlyForm.some(m => m.wins + m.losses > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-slate-600 hover:text-slate-400 transition-colors text-sm">←</Link>
        <div>
          <p className="section-header mb-0">Player Profile</p>
          <h1 className="page-title">{player.name}</h1>
        </div>
      </div>

      {/* Season stats */}
      <div>
        <p className="section-header">Season {CURRENT_YEAR}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Wins" value={stats?.wins ?? 0} accent />
          <StatCard label="Losses" value={stats?.losses ?? 0} />
          <StatCard label="Played" value={stats?.matches_played ?? 0} />
          <StatCard
            label="Win Rate"
            value={stats?.win_pct != null ? `${(stats.win_pct * 100).toFixed(0)}%` : '—'}
          />
        </div>
      </div>

      {/* Streak & comebacks */}
      {allMatches.length > 0 && (
        <div>
          <p className="section-header">All Time</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {streak.count > 0 && (
              <div className="card p-4">
                <p className="section-header">Current Streak</p>
                <p className={`text-3xl font-bold tracking-tight ${streak.type === 'W' ? 'text-pool-accent' : 'text-pool-loss'}`}>
                  {streak.type}{streak.count}
                </p>
              </div>
            )}
            <StatCard
              label="Comeback Wins"
              value={comebacks}
              sub="Won after losing game 1"
            />
            <StatCard
              label="Total Matches"
              value={allMatches.filter(m => m.winner).length}
            />
          </div>
        </div>
      )}

      {/* Monthly form chart */}
      {hasMonthlyActivity && (
        <div>
          <p className="section-header">Monthly Form</p>
          <div className="card p-4 pt-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyForm} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="wins" name="Wins" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="losses" name="Losses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* H2H records */}
      {h2h.length > 0 && (
        <div>
          <p className="section-header">Head to Head</p>
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="pl-5 text-left">Opponent</th>
                  <th className="text-center">W</th>
                  <th className="text-center">L</th>
                  <th className="text-right pr-5">Win %</th>
                </tr>
              </thead>
              <tbody>
                {h2h.map(rec => {
                  const total = rec.wins + rec.losses
                  const pct = total > 0 ? Math.round((rec.wins / total) * 100) : null
                  return (
                    <tr key={rec.id}>
                      <td className="pl-5">
                        <Link
                          to={`/player/${rec.id}`}
                          className="font-medium text-slate-300 hover:text-pool-accent transition-colors"
                        >
                          {rec.name}
                        </Link>
                      </td>
                      <td className="text-center win-text tabular-nums">{rec.wins}</td>
                      <td className="text-center loss-text tabular-nums">{rec.losses}</td>
                      <td className="text-right pr-5 font-mono text-sm tabular-nums text-slate-300">
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent matches */}
      <div>
        <p className="section-header">Recent Matches</p>
        {recentMatches.length === 0 ? (
          <div className="card p-8 text-center text-slate-600">No matches yet</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="table-base">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-28" />
                <col className="w-20" />
              </colgroup>
              <thead>
                <tr>
                  <th className="pl-5 text-left">Date</th>
                  <th className="text-left">Opponent</th>
                  <th className="text-left">Format</th>
                  <th className="text-right pr-5">Result</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map(m => {
                  const isP1 = m.player1?.id === id
                  const opponent = isP1 ? m.player2 : m.player1
                  const won = m.winner?.id === id
                  const myGames = m.games?.filter(g => g.winner_id === id).length ?? 0
                  const theirGames = m.games?.filter(g => g.winner_id === opponent?.id).length ?? 0

                  return (
                    <tr key={m.id}>
                      <td className="pl-5 text-slate-500 text-xs font-mono whitespace-nowrap">
                        {formatDateShort(m.played_at)}
                      </td>
                      <td>
                        <Link
                          to={`/player/${opponent?.id}`}
                          className="font-medium text-slate-300 hover:text-pool-accent transition-colors"
                        >
                          {opponent?.name}
                        </Link>
                      </td>
                      <td className="text-left text-slate-600 text-xs">
                        {m.format === 'best_of_3' ? `Bo3 (${myGames}–${theirGames})` : '1 game'}
                      </td>
                      <td className="text-right pr-5">
                        {m.winner
                          ? won
                            ? <span className="badge-green">W</span>
                            : <span className="badge-red">L</span>
                          : <span className="badge-gray">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
