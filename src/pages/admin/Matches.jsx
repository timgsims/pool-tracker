import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { orderedMatch } from '../../lib/matchUtils'
import { formatDateShort } from '../../lib/dateUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AdminMatches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const load = () =>
    supabase
      .from('matches')
      .select(`
        id, played_at, format,
        player1:player1_id(id, name),
        player2:player2_id(id, name),
        winner:winner_id(id, name),
        games(winner_id)
      `)
      .order('played_at', { ascending: false })
      .then(({ data }) => { setMatches(data ?? []); setLoading(false) })

  useEffect(() => { load() }, [])

  const deleteMatch = async (id) => {
    if (!confirm('Delete this match and all its game results? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('matches').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-sm">
        {matches.length} matches total. Deleting a match also removes its individual game records.
      </p>

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th className="pl-5">Date</th>
              <th>Match</th>
              <th>Format</th>
              <th>Result</th>
              <th className="text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-600">No matches yet</td></tr>
            ) : matches.map(m => {
              const { left, right } = orderedMatch(m)
              return (
              <tr key={m.id}>
                <td className="pl-5 text-slate-500 text-xs font-mono whitespace-nowrap">
                  {formatDateShort(m.played_at)}
                </td>
                <td className="text-slate-200 text-sm">
                  {left?.name} vs {right?.name}
                </td>
                <td className="text-slate-600 text-xs">
                  {m.format === 'best_of_3' ? 'Bo3' : '1G'}
                </td>
                <td className="text-sm">
                  {m.winner
                    ? <span className="text-pool-accent text-xs">{m.winner.name}</span>
                    : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="text-right pr-5">
                  <button
                    onClick={() => deleteMatch(m.id)}
                    disabled={deleting === m.id}
                    className="text-red-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                  >
                    {deleting === m.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
