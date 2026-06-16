import { useEffect, useState } from 'react'
import { AlertTriangle, Megaphone, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useEvento } from '../contexts/EventoContext'
import { tocarAlerta } from '../hooks/useChat'

// Escuta avisos de sistema em tempo real e abre um modal flutuante
// em qualquer módulo, conforme a segmentação (todos / setor / usuário).
export default function AvisoListener() {
  const { usuario } = useAuth()
  const { evento } = useEvento()
  const [fila, setFila] = useState([])
  const [meusSetores, setMeusSetores] = useState([])

  // setores do usuário no evento (para avisos segmentados por setor)
  useEffect(() => {
    if (!usuario || !evento) return
    supabase.from('designacoes').select('setor_id').eq('usuario_id', usuario.id).eq('evento_id', evento.id)
      .then(({ data }) => setMeusSetores((data || []).map((d) => d.setor_id)))
  }, [usuario, evento])

  useEffect(() => {
    if (!usuario) return
    const canal = supabase
      .channel('avisos-sistema')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, ({ new: a }) => {
        if (a.criado_por === usuario.id) return
        const paraMim =
          a.alvo_tipo === 'todos' ||
          (a.alvo_tipo === 'usuario' && a.alvo_id === usuario.id) ||
          (a.alvo_tipo === 'setor' && meusSetores.includes(a.alvo_id))
        if (!paraMim) return
        if (a.urgente) tocarAlerta()
        else navigator.vibrate?.(150)
        setFila((f) => [...f, a])
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [usuario, meusSetores])

  const aviso = fila[0]
  if (!aviso) return null

  function fechar() { setFila((f) => f.slice(1)) }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 grid place-items-center p-4 animate-[fadeIn_.15s]">
      <div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl
        ${aviso.urgente ? 'ring-4 ring-urgencia' : ''} bg-white dark:bg-slate-800`}>
        <div className={`px-5 py-3 flex items-center gap-2 text-white
          ${aviso.urgente ? 'bg-urgencia' : 'bg-primary'}`}>
          {aviso.urgente ? <AlertTriangle size={22} /> : <Megaphone size={22} />}
          <span className="font-bold flex-1">{aviso.titulo || (aviso.urgente ? 'Alerta do sistema' : 'Aviso do sistema')}</span>
          <button onClick={fechar} aria-label="Fechar"><X size={22} /></button>
        </div>
        <div className="p-5">
          <p className="text-gray-700 dark:text-slate-200 whitespace-pre-wrap text-lg">{aviso.mensagem}</p>
          <div className="text-xs text-gray-400 mt-3">
            {aviso.nome_autor && `Enviado por ${aviso.nome_autor} • `}
            {new Date(aviso.created_at).toLocaleString('pt-BR')}
          </div>
          <button onClick={fechar} className={`btn-lg w-full mt-4 text-white ${aviso.urgente ? 'btn-urgencia' : 'btn-primary'}`}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
