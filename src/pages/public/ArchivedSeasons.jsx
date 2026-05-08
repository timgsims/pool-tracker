import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

function formatSeasonDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function ArchivedSeasons() {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('seasons')
      .select('id, name, start_date, end_date, champion:champion_player_id(id, name)')
      .eq('completed', true)
      .order('end_date', { ascending: false })
      .then(({ data }) => {
        setSeasons(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <p className="section-header">History</p>
        <h1 className="page-title">Archive</h1>
      </div>

      {seasons.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No archived seasons yet"
            message="Completed seasons will appear here once marked complete by the admin."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map(s => (
            <Link
              key={s.id}
              to={`/seasons/${s.id}`}
              className="card px-5 py-4 block hover:border-pool-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-100 text-base">{s.name}</h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {formatSeasonDate(s.start_date)}
                    {' — '}
                    {formatSeasonDate(s.end_date)}
                  </p>
                </div>
                {s.champion && (
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/40">
                    <span className="text-amber-400 text-sm">🏆</span>
                    <span className="text-amber-300 text-sm font-semibold">{s.champion.name}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
