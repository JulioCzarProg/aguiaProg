import { useEffect, useRef, useState } from 'react'
import { AlarmClock, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useEvento } from '../contexts/EventoContext'
import { tocarAlerta } from '../hooks/useChat'

// Cada cliente conhece a agenda de contagem e dispara o modal localmente:
// "prepare-se" (X min antes) e "iniciar" (na hora). Sem depender de servidor.
function hojeKey() { return new Date().toISOString().slice(0, 10) }
function hhmm(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
function menos(hora, min) {
  const [h, m] = hora.split(':').map(Number)
  const d = new Date(); d.setHours(h, m - min, 0, 0)
  return hhmm(d)
}

export default function HorarioWatcher() {
  const { evento } = useEvento()
  const [horarios, setHorarios] = useState([])
  const [aviso, setAviso] = useState(null)
  const disparados = useRef(new Set(JSON.parse(localStorage.getItem('horarios_disparados') || '[]')))

  useEffect(() => {
    if (!evento) return
    supabase.from('horarios_contagem').select('*').eq('evento_id', evento.id)
      .then(({ data }) => setHorarios(data || []))
  }, [evento])

  useEffect(() => {
    if (!horarios.length) return
    const checar = () => {
      const agora = hhmm(new Date()), dia = hojeKey()
      for (const h of horarios) {
        const ante = menos(h.hora, h.antecedencia_min || 10)
        const kA = `${dia}|${h.turno}|antes`, kI = `${dia}|${h.turno}|inicio`
        if (agora === ante && !disparados.current.has(kA)) marcar(kA, {
          tipo: 'antes', titulo: 'Preparar para a contagem',
          msg: `A contagem do turno "${h.turno}" começa em ${h.antecedencia_min || 10} min (${h.hora}). Fiquem a postos nos seus setores.`
        })
        if (agora === h.hora && !disparados.current.has(kI)) marcar(kI, {
          tipo: 'inicio', titulo: 'Iniciar a contagem agora',
          msg: `É hora de contar a assistência do turno "${h.turno}". Façam a contagem e enviem ao capitão.`
        })
      }
    }
    const marcar = (k, av) => {
      disparados.current.add(k)
      localStorage.setItem('horarios_disparados', JSON.stringify([...disparados.current].slice(-50)))
      setAviso(av); tocarAlerta()
    }
    checar()
    const t = setInterval(checar, 20000)
    return () => clearInterval(t)
  }, [horarios])

  if (!aviso) return null
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 grid place-items-center p-4">
      <div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-800 ${aviso.tipo === 'inicio' ? 'ring-4 ring-secundaria' : ''}`}>
        <div className={`px-5 py-3 flex items-center gap-2 text-white ${aviso.tipo === 'inicio' ? 'bg-secundaria' : 'bg-primary'}`}>
          <AlarmClock size={22} /><span className="font-bold flex-1">{aviso.titulo}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar"><X size={22} /></button>
        </div>
        <div className="p-5">
          <p className="text-lg text-gray-700 dark:text-slate-200">{aviso.msg}</p>
          <button onClick={() => setAviso(null)} className="btn-primary btn-lg w-full mt-4">Entendi</button>
        </div>
      </div>
    </div>
  )
}
