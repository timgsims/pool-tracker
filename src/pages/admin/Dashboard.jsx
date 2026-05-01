import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import StatCard from '../../components/ui/StatCard'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ players: 0, matches: 0, users: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('user_roles').select('*', { count: 'exact', head: true }),
    ]).then(([{ count: players }, { count: matches }, { count: users }]) => {
      setCounts({ players: players ?? 0, matches: matches ?? 0, users: users ?? 0 })
    })
  }, [])

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
        ].map(({ to, label, desc }) => (
          <Link key={to} to={to} className="card p-5 hover:border-slate-600 transition-colors block">
            <p className="font-semibold text-slate-100 mb-1">{label}</p>
            <p className="text-slate-500 text-sm">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
