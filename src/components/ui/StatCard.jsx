export default function StatCard({ label, value, sub, accent = false, loss = false, className = '' }) {
  const valueCls = accent ? 'text-pool-accent' : loss ? 'loss-text' : 'text-slate-100'
  return (
    <div className={`card p-4 ${className}`}>
      <p className="section-header">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${valueCls}`}>
        {value}
      </p>
      {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
    </div>
  )
}
