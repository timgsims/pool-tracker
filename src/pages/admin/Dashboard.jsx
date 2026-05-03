import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import StatCard from '../../components/ui/StatCard'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ players: 0, matches: 0, users: 0 })
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetDone, setResetDone] = useState(false)

  const loadCounts = () =>
    Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('user_roles').select('*', { count: 'exact', head: true }),
    ]).then(([{ count: players }, { count: matches }, { count: users }]) => {
      setCounts({ players: players ?? 0, matches: matches ?? 0, users: users ?? 0 })
    })

  const resetAllData = async () => {
    if (!confirm('Delete ALL match, game, and tournament result records?\n\nThis permanently removes every match result, game record, bracket round, and tournament position from the database. Player accounts, profiles, and tournament/season structures are kept. This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? This will wipe the entire match history.')) return
    setResetting(true)
    setResetError('')
    setResetDone(false)
    const { error } = await supabase.rpc('admin_reset_all_data')
    if (error) { setResetError(error.message); setResetting(false); return }
    setResetting(false)
    setResetDone(true)
    loadCounts()
  }

  useEffect(() => { loadCounts() }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Players" value={counts.players} accent />
        <StatCard label="Total Matches" value={counts.matches} />
        <StatCard label="Signed-up Users" value={counts.users} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { to: '/admin/players', label: 'Manage Players', desc: 'Add, edit, or deactivate players and link them to user accounts' },
          { to: '/admin/users', label: 'Manage Users', desc: 'View all signed-up users and assign or change their roles' },
          { to: '/admin/matches', label: 'Edit Matches', desc: 'View, edit, or delete any match result' },
          { to: '/admin/tournaments', label: 'Tournaments', desc: 'Create and manage tournament brackets and round robins' },
          { to: '/admin/seasons', label: 'Seasons', desc: 'Define season date ranges, view standings, and award season champions' },
        ].map(({ to, label, desc }) => (
          <Link key={to} to={to} className="card p-5 hover:border-slate-600 transition-colors block">
            <p className="font-semibold text-slate-100 mb-1">{label}</p>
            <p className="text-slate-500 text-sm">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="border border-red-900/50 rounded-xl p-5 space-y-3 bg-red-950/20">
        <p className="text-red-400 font-semibold text-sm">Danger Zone</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-slate-300 text-sm font-medium">Reset all match data</p>
            <p className="text-slate-500 text-xs">Permanently delete every match, game, and tournament result. Player profiles, tournament structures, and seasons are kept.</p>
          </div>
          <button
            onClick={resetAllData}
            disabled={resetting}
            className="shrink-0 px-4 py-2 rounded-lg bg-red-900/40 border border-red-800/60 text-red-400 hover:bg-red-900/60 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset All Data'}
          </button>
        </div>
        {resetError && <p className="text-red-400 text-xs">{resetError}</p>}
        {resetDone && <p className="text-green-400 text-xs">All match data has been deleted.</p>}
      </div>
    </div>
  )
}
