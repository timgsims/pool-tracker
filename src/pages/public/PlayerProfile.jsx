import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateLong, formatDateShort, timeAgo } from '../../lib/dateUtils'
import { orderedMatch } from '../../lib/matchUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import { computeElo, computeEloRatings } from '../../lib/eloUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatCard from '../../components/ui/StatCard'
import Avatar from '../../components/ui/Avatar'

function gameSeq(games, playerId) {
  if (!games?.length) return null
  return [...games]
    .sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
    .map(g => g.winner_id === playerId ? 'W' : 'L')
    .join('-')
}

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

function computeLongestStreaks(matches, playerId) {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0
  const sorted = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
  for (const m of sorted) {
    if (!m.winner) continue
    if (m.winner.id === playerId) { curWin++; curLoss = 0 }
    else { curLoss++; curWin = 0 }
    if (curWin > maxWin) maxWin = curWin
    if (curLoss > maxLoss) maxLoss = curLoss
  }
  return { longestWin: maxWin, longestLoss: maxLoss }
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
  const { isAdmin, linkedPlayerId, refreshRole } = useAuth()
  const [player, setPlayer] = useState(null)
  const [allMatches, setAllMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef(null)

  const [nameMap, setNameMap] = useState({})
  const [activeSeason, setActiveSeason] = useState(null)
  const [allSeasons, setAllSeasons] = useState([])
  const [seasonStats, setSeasonStats] = useState(null)
  const [trophies, setTrophies] = useState([])
  const [tournamentRecord, setTournamentRecord] = useState(null)
  const [eloRatings, setEloRatings] = useState({})
  const [allTimeEloRatings, setAllTimeEloRatings] = useState({})
  const [eloDeltas, setEloDeltas] = useState({})
  const [profileView, setProfileView] = useState('season')

  const canUpload = isAdmin || linkedPlayerId === id

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: m }, { data: allPlayers }, { data: season }, { data: wonSeasons }, { data: tParts }, { data: allSeasonsData }, { data: allRegularMatches }] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),

        supabase
          .from('matches')
          .select(`
            id, played_at, format, tournament_id,
            tournament:tournament_id(name),
            player1:player1_id(id, name, avatar_url),
            player2:player2_id(id, name, avatar_url),
            winner:winner_id(id, name),
            games(game_number, winner_id)
          `)
          .or(`player1_id.eq.${id},player2_id.eq.${id}`)
          .order('played_at', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase.from('players').select('id, name'),

        supabase.from('seasons').select('id, name, start_date, end_date').eq('is_active', true).maybeSingle(),

        supabase
          .from('seasons')
          .select('id, name, end_date')
          .eq('champion_player_id', id)
          .eq('completed', true)
          .order('end_date', { ascending: false }),

        supabase
          .from('tournament_participants')
          .select('tournament_id, final_position')
          .eq('player_id', id),

        supabase.from('seasons').select('id, start_date, end_date, stats_available'),

        supabase.from('matches').select('id, played_at, player1_id, player2_id, winner_id')
          .not('winner_id', 'is', null).order('played_at', { ascending: true }),
      ])

      if (!p) { setNotFound(true); setLoading(false); return }

      const matches = m ?? []
      const regularMatches = matches.filter(m => !m.tournament_id)
      const tournamentMatches = matches.filter(m => m.tournament_id)

      // Compute active season stats from match dates
      let computed = null
      if (season) {
        const from = new Date(season.start_date + 'T00:00:00')
        const to = new Date(season.end_date + 'T23:59:59')
        const seasonM = regularMatches.filter(m => {
          const d = new Date(m.played_at)
          return d >= from && d <= to && m.winner
        })
        const wins = seasonM.filter(m => m.winner.id === id).length
        const losses = seasonM.filter(m => m.winner.id !== id).length
        const played = wins + losses
        computed = { wins, losses, matches_played: played, win_pct: played > 0 ? wins / played : null }
      }

      const tEntered = (tParts ?? []).length
      const tWon = (tParts ?? []).filter(tp => tp.final_position === 1).length
      const tWinRate = tEntered > 0 ? tWon / tEntered : null

      const seasonMatchesForElo = season
        ? (allRegularMatches ?? []).filter(m => m.played_at >= season.start_date && m.played_at <= season.end_date + 'T23:59:59')
        : []

      setPlayer(p)
      setActiveSeason(season ?? null)
      setAllSeasons(allSeasonsData ?? [])
      setSeasonStats(computed)
      setTrophies(wonSeasons ?? [])
      setTournamentRecord(tEntered > 0 ? { entered: tEntered, won: tWon, winRate: tWinRate } : null)
      const { ratings: seasonElo } = computeElo(seasonMatchesForElo)
      const { ratings: allTimeElo, deltas } = computeElo(allRegularMatches ?? [])
      setEloRatings(seasonElo)
      setAllTimeEloRatings(allTimeElo)
      setEloDeltas(deltas)
      setAllMatches(matches)
      setNameMap(buildDisplayNames(allPlayers ?? []))
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
      const bustedUrl = `${publicUrl}?t=${Date.now()}`
      await supabase.rpc('update_player_avatar', { p_player_id: id, p_avatar_url: bustedUrl })
      setPlayer(prev => ({ ...prev, avatar_url: bustedUrl }))
      await refreshRole()
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

  const n = pid => nameMap[pid] ?? ''

  // Scope matches based on toggle
  const scopedMatches = (profileView === 'season' && activeSeason)
    ? allMatches.filter(m =>
        m.played_at >= activeSeason.start_date &&
        m.played_at <= activeSeason.end_date + 'T23:59:59'
      )
    : allMatches

  // All-time regular match summary (for All Time stats grid)
  const allTimeRegular = allMatches.filter(m => !m.tournament_id && m.winner)
  const allTimeW = allTimeRegular.filter(m => m.winner.id === id).length
  const allTimeL = allTimeRegular.length - allTimeW
  const allTimePlayed = allTimeRegular.length

  const scopedRegular = scopedMatches.filter(m => !m.tournament_id)
  const scopedTournament = scopedMatches.filter(m => m.tournament_id)

  const streak = computeStreak(scopedMatches, id)
  const comebacks = computeComebacks(scopedMatches, id)
  const monthlyForm = buildMonthlyForm(scopedMatches, id)
  const h2h = computeH2H(scopedRegular, id)
  const tournamentH2H = computeH2H(scopedTournament, id)
  const longestStreaks = computeLongestStreaks(scopedMatches, id)

  const todayStr = new Date().toISOString().slice(0, 10)
  const excludedRanges = allSeasons
    .filter(s => !s.stats_available && s.end_date < todayStr)
    .map(s => ({ from: s.start_date, to: s.end_date + 'T23:59:59' }))
  const dateReliableAllMatches = excludedRanges.length > 0
    ? allMatches.filter(m => !excludedRanges.some(r => m.played_at >= r.from && m.played_at <= r.to))
    : allMatches
  const effectiveLongestStreaks = profileView === 'alltime'
    ? computeLongestStreaks(dateReliableAllMatches, id)
    : longestStreaks

  const lastTen = scopedMatches.filter(m => m.format === 'best_of_3' && m.winner).slice(0, 10).map(m => m.winner.id === id ? 'W' : 'L')
  const qualified = h2h.filter(o => o.wins + o.losses >= 3)
  const favOpponent = [...qualified].sort((a, b) => (b.wins / (b.wins + b.losses)) - (a.wins / (a.wins + a.losses)))[0] ?? null
  const rival = [...qualified].sort((a, b) => (b.losses / (b.wins + b.losses)) - (a.losses / (a.wins + a.losses)))[0] ?? null
  const recentMatches = scopedMatches.slice(0, 10)
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
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
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

      {/* View toggle */}
      {activeSeason && (
        <div className="flex items-center gap-1 p-1 bg-pool-elevated rounded-lg w-fit">
          <button
            onClick={() => setProfileView('season')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              profileView === 'season' ? 'bg-pool-card text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            This Season
          </button>
          <button
            onClick={() => setProfileView('alltime')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              profileView === 'alltime' ? 'bg-pool-card text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            All Time
          </button>
        </div>
      )}

      {/* Stats section — season view */}
      {activeSeason && profileView === 'season' && (
        <div>
          <p className="section-header">Season — {activeSeason.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Wins" value={seasonStats?.wins ?? 0} accent />
            <StatCard label="Losses" value={seasonStats?.losses ?? 0} />
            <StatCard label="Played" value={seasonStats?.matches_played ?? 0} />
            <StatCard
              label="Win Rate"
              value={seasonStats?.win_pct != null ? `${(seasonStats.win_pct * 100).toFixed(0)}%` : '—'}
            />
            {eloRatings[id] && (
              <StatCard
                label="Elo Rating"
                value={eloRatings[id].isProvisional ? `~${eloRatings[id].rating}` : eloRatings[id].rating}
                sub={eloRatings[id].isProvisional ? 'provisional' : undefined}
              />
            )}
            {streak.count > 0 && (
              <div className="card p-4">
                <p className="section-header">Current Streak</p>
                <p className={`text-3xl font-bold tracking-tight ${streak.type === 'W' ? 'text-pool-accent' : 'text-pool-loss'}`}>
                  {streak.type}{streak.count}
                </p>
              </div>
            )}
            <StatCard label="Comeback Wins" value={comebacks} sub="After losing game 1" />
            {effectiveLongestStreaks.longestWin > 0 && (
              <StatCard label="Longest Win Streak" value={effectiveLongestStreaks.longestWin} accent sub="This season" />
            )}
            {effectiveLongestStreaks.longestLoss > 0 && (
              <StatCard label="Longest Loss Streak" value={effectiveLongestStreaks.longestLoss} loss sub="This season" />
            )}
            <StatCard label="Total Matches" value={scopedMatches.filter(m => m.winner).length} />
            {scopedMatches[0]?.played_at && (
              <StatCard label="Last Match" value={timeAgo(scopedMatches[0].played_at)} />
            )}
          </div>
        </div>
      )}

      {/* Stats section — all time view */}
      {profileView === 'alltime' && allTimePlayed > 0 && (
        <div>
          <p className="section-header">All Time</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Wins" value={allTimeW} accent />
            <StatCard label="Losses" value={allTimeL} />
            <StatCard label="Played" value={allTimePlayed} />
            <StatCard
              label="Win Rate"
              value={allTimePlayed > 0 ? `${Math.round(allTimeW / allTimePlayed * 100)}%` : '—'}
            />
            {allTimeEloRatings[id] && (
              <StatCard
                label="Elo Rating"
                value={allTimeEloRatings[id].isProvisional ? `~${allTimeEloRatings[id].rating}` : allTimeEloRatings[id].rating}
                sub={allTimeEloRatings[id].isProvisional ? 'provisional' : undefined}
              />
            )}
            <StatCard label="Comeback Wins" value={comebacks} sub="After losing game 1" />
            {effectiveLongestStreaks.longestWin > 0 && (
              <StatCard label="Longest Win Streak" value={effectiveLongestStreaks.longestWin} accent />
            )}
            {effectiveLongestStreaks.longestLoss > 0 && (
              <StatCard label="Longest Loss Streak" value={effectiveLongestStreaks.longestLoss} loss />
            )}
            <StatCard label="Total Matches" value={scopedMatches.filter(m => m.winner).length} />
            {scopedMatches[0]?.played_at && (
              <StatCard label="Last Match" value={timeAgo(scopedMatches[0].played_at)} />
            )}
          </div>
        </div>
      )}

      {/* Stats section — no active season (career) */}
      {!activeSeason && allTimePlayed > 0 && (
        <div>
          <p className="section-header">Career</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Wins" value={allTimeW} accent />
            <StatCard label="Losses" value={allTimeL} />
            <StatCard label="Played" value={allTimePlayed} />
            <StatCard
              label="Win Rate"
              value={allTimePlayed > 0 ? `${Math.round(allTimeW / allTimePlayed * 100)}%` : '—'}
            />
            {allTimeEloRatings[id] && (
              <StatCard
                label="Elo Rating"
                value={allTimeEloRatings[id].isProvisional ? `~${allTimeEloRatings[id].rating}` : allTimeEloRatings[id].rating}
                sub={allTimeEloRatings[id].isProvisional ? 'provisional' : undefined}
              />
            )}
            <StatCard label="Comeback Wins" value={comebacks} sub="After losing game 1" />
            {effectiveLongestStreaks.longestWin > 0 && (
              <StatCard label="Longest Win Streak" value={effectiveLongestStreaks.longestWin} accent />
            )}
            {effectiveLongestStreaks.longestLoss > 0 && (
              <StatCard label="Longest Loss Streak" value={effectiveLongestStreaks.longestLoss} loss />
            )}
            <StatCard label="Total Matches" value={scopedMatches.filter(m => m.winner).length} />
            {scopedMatches[0]?.played_at && (
              <StatCard label="Last Match" value={timeAgo(scopedMatches[0].played_at)} />
            )}
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

      {/* Tournament record */}
      {tournamentRecord && (
        <div>
          <p className="section-header">Tournament Record</p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Entered" value={tournamentRecord.entered} />
            <StatCard label="T. Wins" value={tournamentRecord.won} accent />
            <StatCard
              label="T. Win Rate"
              value={tournamentRecord.winRate != null ? `${(tournamentRecord.winRate * 100).toFixed(0)}%` : '—'}
            />
          </div>
        </div>
      )}

      {/* Last 10 Bo3 results — season view only */}
      {profileView === 'season' && lastTen.length > 0 && (
        <div>
          <p className="section-header">Last {lastTen.length} Bo3 Results</p>
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
          <p className="text-slate-600 text-xs -mt-2 mb-3">Best win rate against a single opponent (min. 3 matches)</p>
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

      {/* Rival */}
      {rival && (
        <div>
          <p className="section-header">Rival</p>
          <p className="text-slate-600 text-xs -mt-2 mb-3">Opponent with the best win rate against this player (min. 3 matches)</p>
          <div className="card p-4 flex items-center justify-between gap-4">
            <div>
              <Link
                to={`/player/${rival.id}`}
                className="font-semibold text-slate-100 hover:text-pool-accent transition-colors"
              >
                {nameMap[rival.id] ?? rival.name}
              </Link>
              <p className="text-slate-500 text-xs mt-0.5">
                {rival.wins + rival.losses} matches played
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-semibold">
                <span className="win-text">{rival.wins}W</span>
                <span className="text-slate-600 mx-1">–</span>
                <span className="loss-text">{rival.losses}L</span>
              </p>
              <p className="loss-text font-bold text-lg tabular-nums">
                {Math.round((rival.losses / (rival.wins + rival.losses)) * 100)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly form chart — season view only */}
      {profileView === 'season' && hasMonthlyActivity && (
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
      {(h2h.length > 0 || tournamentH2H.length > 0) && (
        <div>
          <p className="section-header">Head to Head</p>
          {h2h.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 mb-2">Regular</p>
              <div className="card overflow-x-auto">
                <table className="table-base">
                  <colgroup>
                    <col />
                    <col className="w-12" />
                    <col className="w-12" />
                    <col className="w-16" />
                    <col className="w-20" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="pl-5 text-left">Opponent</th>
                      <th className="text-center">W</th>
                      <th className="text-center">L</th>
                      <th className="text-center">Win %</th>
                      <th className="text-right pr-5">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.map(rec => {
                      const total = rec.wins + rec.losses
                      const pct = total > 0 ? Math.round((rec.wins / total) * 100) : null
                      const elo = eloRatings[rec.id]
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
                          <td className="text-center font-mono text-sm tabular-nums text-slate-300">
                            {pct != null ? `${pct}%` : '—'}
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
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tournamentH2H.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 mt-4 mb-2">Tournament</p>
              <div className="card overflow-x-auto">
                <table className="table-base">
                  <colgroup>
                    <col />
                    <col className="w-12" />
                    <col className="w-12" />
                    <col className="w-16" />
                    <col className="w-20" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="pl-5 text-left">Opponent</th>
                      <th className="text-center">W</th>
                      <th className="text-center">L</th>
                      <th className="text-center">Win %</th>
                      <th className="text-right pr-5">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentH2H.map(rec => {
                      const total = rec.wins + rec.losses
                      const pct = total > 0 ? Math.round((rec.wins / total) * 100) : null
                      const elo = eloRatings[rec.id]
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
                          <td className="text-center font-mono text-sm tabular-nums text-slate-300">
                            {pct != null ? `${pct}%` : '—'}
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
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Recent matches — season view only */}
      {profileView === 'season' && <div>
        <p className="section-header">Recent Matches</p>
        {recentMatches.length === 0 ? (
          <div className="card p-8 text-center text-slate-600">No matches yet</div>
        ) : (
          <div className="space-y-3">
            {recentMatches.map(m => {
              const { left, right, leftScore, rightScore, leftWon, rightWon } = orderedMatch(m)
              const isBo3 = m.format === 'best_of_3'
              const leftGames = isBo3 ? gameSeq(m.games, left?.id) : null
              const rightGames = isBo3 ? gameSeq(m.games, right?.id) : null
              const md = eloDeltas[m.id]
              const leftDelta = md?.[left?.id]
              const rightDelta = md?.[right?.id]
              return (
                <div key={m.id} className="card px-5 py-4">
                  {m.winner && (
                    <div className="text-center mb-2">
                      <span className="badge-green">{n(m.winner.id)} wins</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                      {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                      <span className={`font-bold text-base truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(left?.id)}</span>
                      <Avatar name={left?.name} src={left?.avatar_url} size="sm" />
                    </div>
                    <span className="text-slate-600 text-sm shrink-0 w-6 text-center">vs</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Avatar name={right?.name} src={right?.avatar_url} size="sm" />
                      <span className={`font-bold text-base truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(right?.id)}</span>
                      {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                      {rightGames && <span className="text-slate-500 text-xs shrink-0">({rightGames})</span>}
                    </div>
                  </div>
                  {leftDelta !== undefined && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 flex justify-end">
                        <span className={`text-xs font-bold tabular-nums ${leftDelta > 0 ? 'win-text' : leftDelta < 0 ? 'loss-text' : 'text-slate-500'}`}>
                          {leftDelta > 0 ? `+${leftDelta}` : leftDelta}
                        </span>
                      </div>
                      <span className="text-slate-600 text-xs whitespace-nowrap shrink-0">ELO RANK CHANGE</span>
                      <div className="flex-1">
                        <span className={`text-xs font-bold tabular-nums ${rightDelta > 0 ? 'win-text' : rightDelta < 0 ? 'loss-text' : 'text-slate-500'}`}>
                          {rightDelta > 0 ? `+${rightDelta}` : rightDelta}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center text-xs text-slate-600 mt-2">
                    <span className="flex-1 text-right">{formatDateLong(m.played_at)}</span>
                    <span className="w-6 shrink-0 text-center">·</span>
                    <span className="flex-1">{m.tournament
                      ? (isBo3 ? 'Tournament · Bo3' : 'Tournament · Single game')
                      : (isBo3 ? 'Best of 3' : 'Single game')
                    }</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>}
    </div>
  )
}
