import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

const isTest = import.meta.env.VITE_ENV_NAME === 'test'

if (isTest) {
  const base = import.meta.env.BASE_URL
  // Remove existing icon links and insert fresh ones so browsers don't ignore the change
  document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach(el => el.remove())
  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.type = 'image/png'
  favicon.href = `${base}icon-test.png?v=test`
  document.head.appendChild(favicon)
  const touchIcon = document.createElement('link')
  touchIcon.rel = 'apple-touch-icon'
  touchIcon.href = `${base}icon-test.png?v=test`
  document.head.appendChild(touchIcon)
  document.title = 'TEST 8-Ball Pool Tracker'
}

export default function Layout() {
  return (
    <div className={`min-h-screen bg-pool-bg flex flex-col${isTest ? ' outline outline-4 outline-orange-500 outline-offset-[-4px] fixed inset-0 overflow-auto' : ''}`}>
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
