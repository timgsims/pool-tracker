import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

const isTest = import.meta.env.VITE_ENV_NAME === 'test'

// The dev build's orange icons are swapped in at build time (devIcons in vite.config.js)
if (isTest) {
  document.title = 'DEV 8-Ball Pool Tracker'
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-pool-bg flex flex-col">
      {isTest && (
        <div className="fixed inset-0 border-4 border-orange-500 pointer-events-none z-[9999]" />
      )}
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 animate-fade-in">
        <Outlet />
      </main>
      <footer className="border-t border-pool-border/50 py-4 text-center text-slate-700 text-xs">
        8-Ball Pool Tracker
      </footer>
    </div>
  )
}
