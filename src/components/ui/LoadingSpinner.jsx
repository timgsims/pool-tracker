export default function LoadingSpinner({ fullScreen = false, size = 'md' }) {
  const sizes = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-2' }

  const spinner = (
    <div className={`${sizes[size]} border-pool-border border-t-pool-accent rounded-full animate-spin`} />
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-pool-bg flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  )
}
