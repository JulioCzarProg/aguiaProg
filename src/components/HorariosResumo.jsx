import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { supabase } from '../supabase'

// Mostra os horários de contagem. Se `turnos` for passado, filtra só esses
// (voluntário/capitão); sem `turnos`, mostra todos (coordenador/admin).
export default function HorariosResumo({ evento, turnos }) {
  const [horarios, setHorarios] = useState([])

  useEffect(() => {
    if (!evento) return
    supabase.from('horarios_contagem').select('*').eq('evento_id', evento.id).order('turno')
      .then(({ data }) => setHorarios(data || []))
  }, [evento])

  const lista = turnos ? horarios.filter((h) => turnos.includes(h.turno)) : horarios
  if (!lista.length) return null

  return (
    <div className="card">
      <div className="flex items-center gap-2 font-semibold mb-2"><AlarmClock size={18} className="text-primary" /> Horários de contagem</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {lista.map((h) => (
          <div key={h.id} className="rounded-lg border dark:border-slate-700 px-3 py-2 text-sm">
            <div className="font-medium">{h.turno}</div>
            <div className="text-primary font-bold text-lg">{h.hora}</div>
            <div className="text-[11px] text-gray-400">aviso {h.antecedencia_min || 10} min antes</div>
          </div>
        ))}
      </div>
    </div>
  )
}
