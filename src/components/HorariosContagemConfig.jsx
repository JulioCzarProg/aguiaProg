import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'

const TURNOS = ['Sex Manhã', 'Sex Tarde', 'Sáb Manhã', 'Sáb Tarde', 'Dom Manhã', 'Dom Tarde']
// padrões da planilha: manhã 11:15, tarde 15:00 (domingo 14:30)
const PADRAO = {
  'Sex Manhã': '11:15', 'Sex Tarde': '15:00', 'Sáb Manhã': '11:15',
  'Sáb Tarde': '15:00', 'Dom Manhã': '11:15', 'Dom Tarde': '14:30'
}

export default function HorariosContagemConfig({ evento }) {
  const [linhas, setLinhas] = useState([])

  useEffect(() => {
    if (!evento) return
    supabase.from('horarios_contagem').select('*').eq('evento_id', evento.id)
      .then(({ data }) => {
        const por = Object.fromEntries((data || []).map((h) => [h.turno, h]))
        setLinhas(TURNOS.map((t) => ({
          turno: t,
          hora: por[t]?.hora || PADRAO[t],
          antecedencia_min: por[t]?.antecedencia_min ?? 10
        })))
      })
  }, [evento])

  function set(i, campo, valor) {
    setLinhas((l) => l.map((x, j) => j === i ? { ...x, [campo]: valor } : x))
  }

  async function salvar() {
    const payload = linhas.map((l) => ({
      evento_id: evento.id, turno: l.turno, hora: l.hora, antecedencia_min: Number(l.antecedencia_min) || 10
    }))
    const { error } = await supabase.from('horarios_contagem').upsert(payload, { onConflict: 'evento_id,turno' })
    if (error) return toast.error('Erro: ' + error.message)
    toast.success('Horários salvos! As notificações dispararão automaticamente.')
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold flex items-center gap-2"><AlarmClock size={18} /> Horários de contagem</h2>
      <p className="text-xs text-gray-400">O app avisa os voluntários X minutos antes e na hora de iniciar a contagem de cada turno.</p>
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={l.turno} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="text-sm font-medium">{l.turno}</span>
            <input type="time" className="input w-auto" value={l.hora} onChange={(e) => set(i, 'hora', e.target.value)} />
            <div className="flex items-center gap-1">
              <input type="number" min="0" className="input w-20 text-center" value={l.antecedencia_min}
                onChange={(e) => set(i, 'antecedencia_min', e.target.value)} />
              <span className="text-xs text-gray-400">min antes</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={salvar} className="btn-primary">Salvar horários</button>
    </div>
  )
}
