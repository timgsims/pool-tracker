import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-pool-card border border-pool-accent/50 rounded-xl px-5 py-3 shadow-xl">
      <p className="text-slate-300 text-sm whitespace-nowrap">New version available</p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="btn-primary text-xs py-1.5 px-4 whitespace-nowrap"
      >
        Update now
      </button>
    </div>
  )
}
