import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

const isTest = import.meta.env.VITE_ENV_NAME === 'test'

if (isTest) {
  const base = import.meta.env.BASE_URL
  document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach(el => {
    el.href = `${base}icon-test.png`
  })
  document.title = 'TEST 8-Ball Pool Tracker'
}

export default function Layout() {
  return (
    <div className={`min-h-screen bg-pool-bg flex flex-col${isTest ? ' outline outline-4 outline-orange-500 outline-offset-[-4px] fixed inset-0 overflow-auto' : ''}`}>
      {isTest && (
        <div className="bg-orange-500 text-white text-xs font-bold text-center py-1 tracking-widest uppercase">
          Test Environment
        </div>
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
