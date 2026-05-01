export default function EmptyState({ icon = '●', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl text-pool-border mb-4">{icon}</span>
      <h3 className="text-slate-300 font-semibold mb-1">{title}</h3>
      {message && <p className="text-slate-500 text-sm max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
