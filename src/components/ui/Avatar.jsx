function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, src, size = 'sm', className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${SIZES[size]} rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }
  return (
    <div
      className={`${SIZES[size]} rounded-full bg-pool-elevated border border-pool-border flex items-center justify-center font-semibold text-slate-400 shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  )
}
