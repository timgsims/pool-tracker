import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-pool-bg flex flex-col">
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
