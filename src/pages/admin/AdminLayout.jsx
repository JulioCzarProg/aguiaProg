import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Tag, CalendarRange, Map, Handshake,
  Hash, Megaphone, ScrollText, Settings, Menu, ArrowLeft, LogOut, MessageCircle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'

const itens = [
  { to: '/admin', fim: true, label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/admin/usuarios', label: 'Usuários', Icon: Users },
  { to: '/admin/setores', label: 'Setores', Icon: Tag },
  { to: '/admin/programacao', label: 'Programação', Icon: CalendarRange },
  { to: '/admin/mapa', label: 'Mapa', Icon: Map },
  { to: '/admin/reunioes', label: 'Reuniões', Icon: Handshake },
  { to: '/admin/contagens', label: 'Contagens', Icon: Hash },
  { to: '/admin/chat', label: 'Chat', Icon: MessageCircle },
  { to: '/admin/avisos', label: 'Avisos', Icon: Megaphone },
  { to: '/admin/logs', label: 'Logs', Icon: ScrollText },
  { to: '/admin/config', label: 'Configurações', Icon: Settings }
]

export default function AdminLayout() {
  const [aberto, setAberto] = useState(false)
  const { usuario, logout } = useAuth()
  const { evento } = useEvento()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900">
      {/* Backdrop mobile */}
      {aberto && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setAberto(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 border-r dark:border-slate-700
        transform transition-transform lg:translate-x-0 ${aberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b dark:border-slate-700">
          <img src="/logo.svg" className="w-7" alt="" />
          <span className="font-bold text-lg">Indicador360</span>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {itens.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.fim} onClick={() => setAberto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                 ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
              <i.Icon size={18} /> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t dark:border-slate-700">
          <button onClick={() => navigate('/app')} className="btn-ghost w-full text-sm mb-2"><ArrowLeft size={16} /> Voltar ao app</button>
          <button onClick={() => { logout(); navigate('/login') }} className="text-sm text-gray-500 w-full flex items-center justify-center gap-1"><LogOut size={15} /> Sair</button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center gap-3 px-4 sticky top-0 z-20">
          <button onClick={() => setAberto((v) => !v)} className="lg:hidden"><Menu size={26} /></button>
          <div className="font-semibold truncate">{evento?.nome || 'Nenhum evento'}</div>
          <div className="ml-auto text-sm text-gray-500">{usuario?.nome} • <span className="capitalize">{usuario?.funcao}</span></div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
