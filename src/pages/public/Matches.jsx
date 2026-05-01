import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateLong } from '../../lib/dateUtils'
import { buildDisplayNames } from '../../lib/nameUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('matches')
        .select(`
          id, played_at, format, notes,
          player1:player1_id(id, name),
          player2:player2_id(id, name),
          winner:winner_id(id, name),
          tournament:tournament_id(name),
          games(game_number, winner_id)
        `)
        .order('played_at', { ascending: false }),
      supabase
        .from('players')
        .select('id, name'),
    ]).then(([{ data: m }, { data: p }]) => {
      setMatches(m ?? [])
      setNameMap(buildDisplayNames(p ?? []))
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  const n = id => nameMap[id] ?? ''

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">History</p>
        <h1 className="page-title">All Matches</h1>
      </div>

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

            return (
              <div key={m.id} className="card px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* Left side — right-aligned */}
                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                    {leftGames && <span className="text-slate-500 text-xs shrink-0">({leftGames})</span>}
                    {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${leftWon ? 'win-text' : 'loss-text'}`}>{leftScore}</span>}
                    <span className={`font-bold text-base truncate ${leftWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(left?.id)}</span>
                  </div>

                  {/* Center pivot */}
                  <span className="text-slate-600 text-sm shrink-0 w-6 text-center">vs</span>

                  {/* Right side — left-aligned */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={`font-bold text-base truncate ${rightWon ? 'text-slate-100' : 'text-slate-500'}`}>{n(right?.id)}</span>
                    {isBo3 && <span className={`font-bold tabular-nums shrink-0 ${rightWon ? 'win-text' : 'loss-text'}`}>{rightScore}</span>}
                    {rightGames && <span className="text-slate-500 text-xs shrink-0">({rightGames})</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>{formatDate(m.played_at)}</span>
                    <span>·</span>
                    <span>{isBo3 ? 'Best of 3' : 'Single game'}</span>
                    {m.tournament && (
                      <>
                        <span>·</span>
                        <span className="text-slate-500">{m.tournament.name}</span>
                      </>
                    )}
                  </div>
                  {m.winner && (
                    <span className="badge-green shrink-0">{n(m.winner.id)} wins</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
