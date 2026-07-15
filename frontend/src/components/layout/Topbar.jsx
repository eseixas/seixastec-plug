import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-4 border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <User size={16} />
        </span>
        <div className="leading-tight">
          <p className="font-medium text-gray-800">{user?.nome || 'Usuário'}</p>
          <p className="text-xs text-gray-400">{user?.role || ''}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        title="Sair"
      >
        <LogOut size={16} />
        Sair
      </button>
    </header>
  )
}
