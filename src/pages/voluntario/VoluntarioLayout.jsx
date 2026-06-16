import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutGrid, Map, MessageCircle, HelpCircle } from 'lucide-react'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'

const abas = [
  { to: '/app', fim: true, label: 'Meu Setor', Icon: LayoutGrid },
  { to: '/app/mapa', label: 'Mapa', Icon: Map },
  { to: '/app/chat', label: 'Chat', Icon: MessageCircle },
  { to: '/app/ajuda', label: 'Ajuda', Icon: HelpCircle }
]

export default function VoluntarioLayout() {
  const { usuario, logout, temNivel } = useAuth()
  const { evento, setEvento } = useEvento()
  const navigate = useNavigate()
  const [naoLidas, setNaoLidas] = useState(0)

  // Badge simples de não lidas: conta mensagens após o último "visto"
  useEffect(() => {
    const visto = Number(localStorage.getItem('chat_visto') || 0)
    const canal = supabase
      .channel('badge-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' },
        (p) => {
          if (p.new.usuario_id === usuario?.id) return
          if (!location.pathname.endsWith('/chat')) setNaoLidas((n) => n + 1)
        })
      .subscribe()
    return () => { supabase.removeChannel(canal); void visto }
  }, [usuario?.id])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="min-w-0">
          <div className="font-bold leading-tight truncate">{evento?.nome}</div>
          <div className="text-xs text-white/80">{usuario?.nome}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {temNivel('coordenador') && (
            <button onClick={() => navigate('/admin')} className="underline">Admin</button>
          )}
          <button onClick={() => { setEvento(null); navigate('/eventos') }} className="underline">Trocar</button>
          <button onClick={() => { logout(); navigate('/login') }} className="underline">Sair</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-20">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {abas.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.fim}
              onClick={() => a.label === 'Chat' && setNaoLidas(0)}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs relative
                 ${isActive ? 'text-primary font-semibold' : 'text-gray-500'}`}>
              <a.Icon size={24} />
              {a.label}
              {a.label === 'Chat' && naoLidas > 0 && (
                <span className="absolute top-1 right-6 bg-urgencia text-white text-[10px] rounded-full min-w-[18px] h-[18px] grid place-items-center px-1 animate-pisca">
                  {naoLidas}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
