import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tournaments')
      .select(`
        id, name, date, format, notes,
        tournament_participants(
          final_position,
          player:player_id(id, name)
        )
      `)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data ?? [])
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
            const sorted = [...(t.tournament_participants ?? [])].sort(
              (a, b) => (a.final_position ?? 99) - (b.final_position ?? 99)
            )
            const winner = sorted.find(p => p.final_position === 1)

            return (
              <div key={t.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-slate-100 text-lg">{t.name}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span>·</span>
                      <span className="capitalize">{t.format.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{t.tournament_participants?.length ?? 0} players</span>
                    </div>
                  </div>
                  {winner && (
                    <div className="text-right">
                      <p className="text-xs text-slate-600 mb-0.5">Winner</p>
                      <p className="font-bold text-pool-accent">{winner.player?.name}</p>
                    </div>
                  )}
                </div>

                {sorted.length > 0 && (
                  <div className="border-t border-pool-border/50 pt-3">
                    <p className="section-header mb-2">Final standings</p>
                    <div className="space-y-1">
                      {sorted.map(p => (
                        <div key={p.player?.id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-600 w-5 text-right font-mono text-xs">
                            {p.final_position ?? '—'}
                          </span>
                          <span className={p.final_position === 1 ? 'text-slate-100 font-semibold' : 'text-slate-400'}>
                            {p.player?.name}
                          </span>
                        </div>
                      ))}
                    </div>
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
