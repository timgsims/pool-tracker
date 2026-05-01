export default function StatCard({ label, value, sub, accent = false, className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <p className="section-header">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-pool-accent' : 'text-slate-100'}`}>
        {value}
      </p>
      {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
    </div>
  )
}
