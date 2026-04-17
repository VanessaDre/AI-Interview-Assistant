import { Routes, Route, NavLink } from 'react-router-dom'
import { Shield, FileText, Users, Home, Sparkles } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import InterviewKit from './pages/InterviewKit'
import Compliance from './pages/Compliance'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/upload', icon: FileText, label: 'Upload' },
  { to: '/interview', icon: Sparkles, label: 'Interview Kit' },
  { to: '/compliance', icon: Shield, label: 'Compliance' },
]

export default function App() {
  return (
    <div className="min-h-screen flex">
      <nav className="w-60 shrink-0 bg-gradient-to-b from-brand-700 to-brand-900 p-5 flex flex-col gap-1">
        <div className="mb-8 px-3">
          <h1 className="text-lg font-bold text-white">Interview</h1>
          <p className="text-xs text-brand-300">AI Assistant v0.2</p>
        </div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive ? 'bg-white/15 text-white font-medium' : 'text-brand-200 hover:bg-white/10 hover:text-white'
              }`}>
            <Icon size={18} />{label}
          </NavLink>
        ))}
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-brand-300"><Shield size={14} /><span>EU AI Act compliant</span></div>
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-brand-300"><Users size={14} /><span>DSGVO konform</span></div>
        </div>
      </nav>
      <main className="flex-1 p-8 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/interview" element={<InterviewKit />} />
          <Route path="/compliance" element={<Compliance />} />
        </Routes>
      </main>
    </div>
  )
}
