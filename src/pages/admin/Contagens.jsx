import { useEffect, useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import { useRealtime } from '../../hooks/useRealtime'
import { exportarCSV } from '../../lib/csv'
import { confirmar } from '../../lib/dialog'

const STATUS = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40' },
  validada: { label: 'Validada', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40' },
  rejeitada: { label: 'Recusada', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40' }
}

export default function Contagens() {
  const { evento } = useEvento()
  const [contagens, setContagens] = useState([])
  const [setores, setSetores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [filtroTurno, setFiltroTurno] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  async function carregar() {
    if (!evento) return
    const [{ data: cs }, { data: st }, { data: us }] = await Promise.all([
      supabase.from('contagens').select('*').eq('evento_id', evento.id).order('created_at', { ascending: false }),
      supabase.from('setores').select('id, codigo, nome').eq('evento_id', evento.id),
      supabase.from('usuarios').select('id, nome')
    ])
    setContagens(cs || []); setSetores(st || []); setUsuarios(us || [])
  }
  useEffect(() => { carregar() }, [evento])
  useRealtime('contagens', { onInsert: carregar, onUpdate: carregar })

  const setorNome = (id) => { const s = setores.find((x) => x.id === id); return s ? `${s.codigo} ${s.nome}` : '—' }
  const usuarioNome = (id) => usuarios.find((u) => u.id === id)?.nome || '—'
  const turnos = useMemo(() => [...new Set(contagens.map((c) => c.turno).filter(Boolean))], [contagens])
  const filtradas = contagens.filter((c) =>
    (!filtroTurno || c.turno === filtroTurno) && (!filtroStatus || (c.status || 'pendente') === filtroStatus))

  const totalManha = filtradas.filter((c) => c.periodo === 'manha').reduce((s, c) => s + (c.quantidade || 0), 0)
  const totalTarde = filtradas.filter((c) => c.periodo === 'tarde').reduce((s, c) => s + (c.quantidade || 0), 0)

  async function limparTurno() {
    if (!filtroTurno) return toast.error('Selecione um turno para limpar.')
    if (!(await confirmar(`Apagar TODAS as contagens do turno "${filtroTurno}"?`, { perigo: true }))) return
    await supabase.from('contagens').delete().eq('evento_id', evento.id).eq('turno', filtroTurno)
    toast.success('Contagens do turno apagadas.'); carregar()
  }

  function exportar() {
    exportarCSV('contagens', filtradas.map((c) => ({
      setor: setorNome(c.setor_id), turno: c.turno, periodo: c.periodo,
      quantidade: c.quantidade, contador: c.nome_contador || usuarioNome(c.usuario_id),
      status: STATUS[c.status || 'pendente']?.label,
      validado_por: c.validado_por ? usuarioNome(c.validado_por) : '',
      data: new Date(c.created_at).toLocaleString('pt-BR')
    })))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">Contagens</h1>
        <select className="input w-auto" value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
          <option value="">Todos os turnos</option>
          {turnos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input w-auto" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="validada">Validada</option>
          <option value="rejeitada">Recusada</option>
        </select>
        <button onClick={exportar} className="btn-ghost"><Download size={16} /> Exportar CSV</button>
        <button onClick={limparTurno} className="btn-urgencia"><Trash2 size={16} /> Limpar turno</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center"><div className="text-sm text-gray-500">Manhã</div><div className="text-3xl font-extrabold text-primary">{totalManha}</div></div>
        <div className="card text-center"><div className="text-sm text-gray-500">Tarde</div><div className="text-3xl font-extrabold text-secundaria">{totalTarde}</div></div>
        <div className="card text-center"><div className="text-sm text-gray-500">Total</div><div className="text-3xl font-extrabold">{totalManha + totalTarde}</div></div>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/50 text-left">
            <tr><th className="p-3">Setor</th><th className="p-3">Turno</th><th className="p-3">Período</th><th className="p-3">Qtd</th><th className="p-3">Status</th><th className="p-3 hidden md:table-cell">Contador</th><th className="p-3 hidden lg:table-cell">Validado por</th><th className="p-3 hidden md:table-cell">Quando</th></tr>
          </thead>
          <tbody>
            {filtradas.map((c) => {
              const st = STATUS[c.status || 'pendente']
              return (
              <tr key={c.id} className="border-t dark:border-slate-700">
                <td className="p-3 font-medium">{setorNome(c.setor_id)}</td>
                <td className="p-3">{c.turno || '—'}</td>
                <td className="p-3 capitalize">{c.periodo === 'manha' ? 'manhã' : c.periodo}</td>
                <td className="p-3 font-bold">{c.quantidade}</td>
                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></td>
                <td className="p-3 hidden md:table-cell">{c.nome_contador || usuarioNome(c.usuario_id)}</td>
                <td className="p-3 hidden lg:table-cell text-gray-500">{c.validado_por ? usuarioNome(c.validado_por) : '—'}</td>
                <td className="p-3 hidden md:table-cell text-gray-500">{new Date(c.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            )})}
            {filtradas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">Nenhuma contagem.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
