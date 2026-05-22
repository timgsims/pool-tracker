import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateLong } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import { computeElo } from '../../lib/eloUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import Avatar from '../../components/ui/Avatar'

const formatDate = formatDateLong

function gameSeq(games, playerId) {
  if (!games?.length) return null
  return [...games]
    .sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
    .map(g => g.winner_id === playerId ? 'W' : 'L')
    .join('-')
}

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [eloDeltas, setEloDeltas] = useState({})
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [seasonStart, setSeasonStart] = useState('')
  const [seasonEnd, setSeasonEnd] = useState('')

  useEffect(() => {
    supabase.from('seasons').select('start_date, end_date').eq('is_active', true).maybeSingle()
      .then(({ data }) => {
        setSeasonStart(data?.start_date ?? '')
        setSeasonEnd(data?.end_date ?? '')
      })
    supabase.from('players').select('id, name')
      .then(({ data }) => setNameMap(buildDisplayNames(data ?? [])))
    // Fetch full match history (lightweight) to compute Elo deltas for all displayed matches
    supabase.from('matches')
      .select('id, played_at, player1_id, player2_id, winner_id')
      .not('winner_id', 'is', null)
      .order('played_at', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => setEloDeltas(computeElo(data ?? []).deltas))
  }, [])

  useEffect(() => {
    setLoading(true)
    let q = supabase
      .from('matches')
      .select(`
        id, played_at, format, notes,
        player1:player1_id(id, name, avatar_url),
        player2:player2_id(id, name, avatar_url),
        winner:winner_id(id, name),
        tournament:tournament_id(name),
        games(game_number, winner_id)
      `)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false })
    if (from) q = q.gte('played_at', from)
    if (to) q = q.lte('played_at', to + 'T23:59:59')
    q.then(({ data }) => {
      setMatches(data ?? [])
      setLoading(false)
    })
  }, [from, to])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">History</p>
        <h1 className="page-title">All Matches</h1>
      </div>

      <DateRangeFilter
        onApply={(f, t) => { setFrom(f); setTo(t) }}
        seasonStart={seasonStart}
        seasonEnd={seasonEnd}
      />

      {matches.length === 0 ? (
        <div className="card">
          <EmptyState title="No matches recorded yet" message="Results entered by players will appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(m => {
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
                  <span className="flex-1 text-right">{formatDate(m.played_at)}</span>
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
    </div>
  )
}
