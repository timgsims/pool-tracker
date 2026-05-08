import { useState } from 'react'

export default function DateRangeFilter({ onApply, seasonStart, seasonEnd }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const apply = (f, t) => {
    setFrom(f)
    setTo(t)
    onApply(f, t)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex items-center gap-2 shrink-0 sm:w-44">
        <span className="text-slate-500 text-xs w-7 shrink-0">From</span>
        <input
          type="date"
          className="input text-sm py-1 flex-1 min-w-0"
          value={from}
          onChange={e => setFrom(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:w-44">
        <span className="text-slate-500 text-xs w-7 shrink-0">To</span>
        <input
          type="date"
          className="input text-sm py-1 flex-1 min-w-0"
          value={to}
          onChange={e => setTo(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => apply(from, to)} className="btn-primary text-xs py-1 px-2.5">
          Apply
        </button>
        {seasonStart && (
          <button onClick={() => apply(seasonStart, seasonEnd)} className="btn-ghost text-xs py-1 px-2.5">
            Current season
          </button>
        )}
      </div>
    </div>
  )
}
