import { useCallback, useEffect, useState } from 'react'
import { Check, X, ClipboardCheck, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'
import { useRealtime } from '../hooks/useRealtime'
import { periodoDoTurno, diaDoTurno } from '../hooks/useContagem'

const TURNOS = ['Sex Manhã', 'Sex Tarde', 'Sáb Manhã', 'Sáb Tarde', 'Dom Manhã', 'Dom Tarde']

// Capitão confere/valida as contagens dos voluntários e pode lançar
// contagem manual por setor (quando o voluntário se ausenta).
export default function ValidarContagens({ evento, usuario }) {
  const [pendentes, setPendentes] = useState([])
  const [setores, setSetores] = useState([])
  const [form, setForm] = useState(null) // {setor_id, turno, quantidade}

  const carregar = useCallback(async () => {
    if (!evento) return
    const { data } = await supabase.from('contagens')
      .select('id, quantidade, turno, periodo, created_at, nome_contador, setores(codigo, nome)')
      .eq('evento_id', evento.id).eq('status', 'pendente')
      .order('created_at', { ascending: false })
    setPendentes(data || [])
  }, [evento])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (!evento) return
    supabase.from('setores').select('id, codigo, nome').eq('evento_id', evento.id).or('tipo.is.null,tipo.eq.setor').order('codigo')
      .then(({ data }) => setSetores(data || []))
  }, [evento])
  useRealtime('contagens', { onInsert: carregar, onUpdate: carregar })

  async function decidir(id, status) {
    const patch = status === 'validada'
      ? { status, validado_por: usuario.id, validado_em: new Date().toISOString() }
      : { status }
    const { error } = await supabase.from('contagens').update(patch).eq('id', id)
    if (error) return toast.error('Erro ao atualizar.')
    setPendentes((p) => p.filter((c) => c.id !== id))
    toast.success(status === 'validada' ? 'Contagem validada!' : 'Contagem recusada.')
  }

  async function lancar() {
    if (!form.setor_id || !form.turno) return toast.error('Escolha setor e turno.')
    const { error } = await supabase.from('contagens').insert({
      evento_id: evento.id, setor_id: form.setor_id, usuario_id: usuario.id,
      turno: form.turno, periodo: periodoDoTurno(form.turno), dia: diaDoTurno(form.turno),
      quantidade: Number(form.quantidade) || 0, origem: 'capitao',
      status: 'validada', validado_por: usuario.id, validado_em: new Date().toISOString(),
      nome_contador: `${usuario.nome} (capitão)`
    })
    if (error) return toast.error('Erro ao lançar.')
    toast.success('Contagem lançada e validada!')
    setForm(null)
  }

  return (
    <div className="card border-amber-300 dark:border-amber-700 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <ClipboardCheck size={20} className="text-amber-600" />
        Contagens — capitão
      </div>

      {pendentes.length === 0 && <p className="text-sm text-gray-400">Nenhuma contagem pendente.</p>}
      <div className="space-y-2">
        {pendentes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border rounded-lg px-3 py-2 dark:border-slate-700">
            <div className="text-2xl font-extrabold text-primary w-14 text-center">{c.quantidade}</div>
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-medium">Setor {c.setores?.codigo} <span className="text-gray-400">• {c.nome_contador}</span></div>
              <div className="text-xs text-gray-500">{c.turno} • {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button onClick={() => decidir(c.id, 'validada')} className="btn w-11 h-11 rounded-full bg-secundaria text-white" aria-label="Validar"><Check size={20} /></button>
            <button onClick={() => decidir(c.id, 'rejeitada')} className="btn w-11 h-11 rounded-full bg-gray-200 dark:bg-slate-700" aria-label="Recusar"><X size={20} /></button>
          </div>
        ))}
      </div>

      {/* Lançar contagem manual (voluntário ausente) */}
      {!form
        ? <button onClick={() => setForm({ setor_id: setores[0]?.id || '', turno: TURNOS[0], quantidade: 0 })}
            className="btn-ghost w-full text-sm"><Plus size={16} /> Lançar contagem por setor</button>
        : (
          <div className="border rounded-xl p-3 dark:border-slate-700 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.setor_id} onChange={(e) => setForm({ ...form, setor_id: e.target.value })}>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nome}</option>)}
              </select>
              <select className="input" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}>
                {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input type="number" min="0" className="input text-center text-xl font-bold" placeholder="Quantidade"
              value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={() => setForm(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={lancar} className="btn-primary flex-1">Lançar</button>
            </div>
          </div>
        )}
    </div>
  )
}
