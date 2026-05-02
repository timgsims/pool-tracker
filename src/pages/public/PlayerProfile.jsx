import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateShort, timeAgo } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatCard from '../../components/ui/StatCard'
import Avatar from '../../components/ui/Avatar'

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
  const { isAdmin, linkedPlayerId } = useAuth()
  const [player, setPlayer] = useState(null)
  const [allMatches, setAllMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef(null)

  const [streak, setStreak] = useState({ type: null, count: 0 })
  const [comebacks, setComebacks] = useState(0)
  const [monthlyForm, setMonthlyForm] = useState([])
  const [h2h, setH2H] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [lastTen, setLastTen] = useState([])
  const [favOpponent, setFavOpponent] = useState(null)
  const [activeSeason, setActiveSeason] = useState(null)
  const [seasonStats, setSeasonStats] = useState(null)
  const [trophies, setTrophies] = useState([])

  const canUpload = isAdmin || linkedPlayerId === id

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: m }, { data: allPlayers }, { data: season }, { data: wonSeasons }] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),

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

        supabase.from('players').select('id, name'),

        supabase.from('seasons').select('id, name, start_date, end_date').eq('is_active', true).maybeSingle(),

        supabase
          .from('seasons')
          .select('id, name, end_date')
          .eq('champion_player_id', id)
          .eq('completed', true)
          .order('end_date', { ascending: false }),
      ])

      if (!p) { setNotFound(true); setLoading(false); return }

      const matches = m ?? []

      // Compute active season stats from match dates
      let computed = null
      if (season) {
        const from = new Date(season.start_date + 'T00:00:00')
        const to = new Date(season.end_date + 'T23:59:59')
        const seasonM = matches.filter(m => {
          const d = new Date(m.played_at)
          return d >= from && d <= to && m.winner
        })
        const wins = seasonM.filter(m => m.winner.id === id).length
        const losses = seasonM.filter(m => m.winner.id !== id).length
        const played = wins + losses
        computed = { wins, losses, matches_played: played, win_pct: played > 0 ? wins / played : null }
      }

      setPlayer(p)
      setActiveSeason(season ?? null)
      setSeasonStats(computed)
      setTrophies(wonSeasons ?? [])
      setAllMatches(matches)
      setStreak(computeStreak(matches, id))
      setComebacks(computeComebacks(matches, id))
      setMonthlyForm(buildMonthlyForm(matches, id))
      const h2hData = computeH2H(matches, id)
      setH2H(h2hData)
      setNameMap(buildDisplayNames(allPlayers ?? []))

      const ten = matches.filter(m => m.winner).slice(0, 10).map(m => m.winner.id === id ? 'W' : 'L')
      setLastTen(ten)

      const fav = h2hData
        .filter(o => o.wins + o.losses >= 3)
        .sort((a, b) => (b.wins / (b.wins + b.losses)) - (a.wins / (a.wins + a.losses)))[0] ?? null
      setFavOpponent(fav)

      setLoading(false)
    }
    load()
  }, [id])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(id, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(id)
      await supabase.from('players').update({ avatar_url: publicUrl }).eq('id', id)
      setPlayer(prev => ({ ...prev, avatar_url: publicUrl }))
    } catch (err) {
      setAvatarError(err.message || 'Upload failed — check the avatars bucket exists and is public.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
      <div className="flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-100 transition-colors text-2xl font-bold leading-none">←</Link>

        {/* Avatar with optional upload */}
        <div className="relative group">
          <Avatar name={player.name} src={player.avatar_url} size="xl" />
          {canUpload && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium disabled:cursor-wait"
              >
                {uploadingAvatar ? '…' : 'Change'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </>
          )}
        </div>

        <div>
          <p className="section-header mb-0">Player Profile</p>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{player.name}</h1>
            {trophies.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-400 text-xs font-bold tracking-wide shrink-0">
                {trophies.length}× Champ
              </span>
            )}
          </div>
          {avatarError && (
            <p className="text-red-400 text-xs mt-1">{avatarError}</p>
          )}
        </div>
      </div>

      {/* Season stats */}
      {activeSeason && (
        <div>
          <p className="section-header">Season — {activeSeason.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Wins" value={seasonStats?.wins ?? 0} accent />
            <StatCard label="Losses" value={seasonStats?.losses ?? 0} />
            <StatCard label="Played" value={seasonStats?.matches_played ?? 0} />
            <StatCard
              label="Win Rate"
              value={seasonStats?.win_pct != null ? `${(seasonStats.win_pct * 100).toFixed(0)}%` : '—'}
            />
          </div>
        </div>
      )}

      {/* Trophy cabinet */}
      {trophies.length > 0 && (
        <div>
          <p className="section-header">Trophy Cabinet</p>
          <div className="flex flex-wrap gap-2">
            {trophies.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40"
              >
                <span className="text-amber-400 text-base">🏆</span>
                <span className="text-amber-300 text-sm font-semibold">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {allMatches[0]?.played_at && (
              <StatCard
                label="Last Match"
                value={timeAgo(allMatches[0].played_at)}
              />
            )}
          </div>
        </div>
      )}

      {/* Last 10 results */}
      {lastTen.length > 0 && (
        <div>
          <p className="section-header">Last {lastTen.length} Results</p>
          <div className="card p-4">
            <div className="flex gap-1">
              {lastTen.map((r, i) => (
                <span
                  key={i}
                  className={`flex-1 h-7 flex items-center justify-center rounded text-xs font-bold min-w-0 ${
                    r === 'W'
                      ? 'bg-green-900/50 text-pool-win border border-green-800/60'
                      : 'bg-red-900/50 text-pool-loss border border-red-900/60'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
            <p className="text-slate-700 text-xs mt-2 text-center">← more recent · older →</p>
          </div>
        </div>
      )}

      {/* Favourite opponent */}
      {favOpponent && (
        <div>
          <p className="section-header">Favourite Opponent</p>
          <div className="card p-4 flex items-center justify-between gap-4">
            <div>
              <Link
                to={`/player/${favOpponent.id}`}
                className="font-semibold text-slate-100 hover:text-pool-accent transition-colors"
              >
                {nameMap[favOpponent.id] ?? favOpponent.name}
              </Link>
              <p className="text-slate-500 text-xs mt-0.5">
                {favOpponent.wins + favOpponent.losses} matches played
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-semibold">
                <span className="win-text">{favOpponent.wins}W</span>
                <span className="text-slate-600 mx-1">–</span>
                <span className="loss-text">{favOpponent.losses}L</span>
              </p>
              <p className="text-pool-accent font-bold text-lg tabular-nums">
                {Math.round((favOpponent.wins / (favOpponent.wins + favOpponent.losses)) * 100)}%
              </p>
            </div>
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
          <div className="card overflow-x-auto">
            <table className="table-base">
              <colgroup>
                <col />
                <col className="w-12" />
                <col className="w-12" />
                <col className="w-20" />
              </colgroup>
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
                          {nameMap[rec.id] ?? rec.name}
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
          <div className="card overflow-x-auto">
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
                          {nameMap[opponent?.id] ?? opponent?.name}
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
