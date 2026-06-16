import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useEvento } from '../contexts/EventoContext'

function IconeTipo({ tipo }) {
  // troféu = congresso, microfone = assembleia
  if (tipo === 'congresso') {
    return (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function fmtData(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function SelecaoEvento() {
  const { eventos, setEvento, carregando } = useEvento()
  const { usuario, logout, temNivel } = useAuth()
  const navigate = useNavigate()

  const ativos = eventos.filter((e) => e.ativo)

  function escolher(ev) {
    setEvento(ev)
    navigate('/app', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-primary text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" className="w-8" alt="" />
          <span className="font-bold text-lg">Indicador360</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="text-white/90 text-sm underline">
          Sair
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        <h2 className="text-xl font-bold mb-1">Olá, {usuario?.nome?.split(' ')[0]} 👋</h2>
        <p className="text-gray-500 mb-5">Escolha o evento para entrar:</p>

        {carregando && <p className="text-gray-400">Carregando eventos…</p>}
        {!carregando && ativos.length === 0 && (
          <div className="card text-center text-gray-500">
            Nenhum evento ativo no momento.
          </div>
        )}

        <div className="space-y-3">
          {ativos.map((ev) => (
            <button key={ev.id} onClick={() => escolher(ev)}
              className="card w-full text-left flex items-center gap-4 hover:border-primary hover:shadow-md transition">
              <div className={`w-14 h-14 rounded-xl grid place-items-center text-white shrink-0
                ${ev.tipo === 'congresso' ? 'bg-secundaria' : 'bg-primary'}`}>
                <IconeTipo tipo={ev.tipo} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg truncate">{ev.nome}</div>
                <div className="text-sm text-gray-500 capitalize">{ev.tipo}</div>
                <div className="text-sm text-gray-500">
                  {ev.local} {ev.data_inicio && `• ${fmtData(ev.data_inicio)}–${fmtData(ev.data_fim)}`}
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>

        {temNivel('coordenador') && (
          <button onClick={() => navigate('/admin')}
            className="btn-secundaria btn-lg w-full mt-6">
            <Settings size={20} /> Painel administrativo
          </button>
        )}
      </main>
    </div>
  )
}
