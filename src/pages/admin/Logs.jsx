import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../supabase'
import { exportarCSV } from '../../lib/csv'

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [filtroUser, setFiltroUser] = useState('')
  const [filtroData, setFiltroData] = useState('')

  useEffect(() => {
    supabase.from('logs_acesso').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data }) => setLogs(data || []))
    supabase.from('usuarios').select('id, nome').then(({ data }) => setUsuarios(data || []))
  }, [])

  const nome = (id) => usuarios.find((u) => u.id === id)?.nome || '—'
  const filtrados = useMemo(() => logs.filter((l) => {
    const okUser = !filtroUser || l.usuario_id === filtroUser
    const okData = !filtroData || l.created_at?.slice(0, 10) === filtroData
    return okUser && okData
  }), [logs, filtroUser, filtroData])

  function exportar() {
    exportarCSV('logs_acesso', filtrados.map((l) => ({
      usuario: nome(l.usuario_id), acao: l.acao, detalhe: l.detalhe,
      ip: l.ip, quando: new Date(l.created_at).toLocaleString('pt-BR')
    })))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">Logs de acesso</h1>
        <select className="input w-auto" value={filtroUser} onChange={(e) => setFiltroUser(e.target.value)}>
          <option value="">Todos usuários</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <input type="date" className="input w-auto" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
        <button onClick={exportar} className="btn-ghost"><Download size={16} /> Exportar CSV</button>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/50 text-left">
            <tr><th className="p-3">Usuário</th><th className="p-3">Ação</th><th className="p-3 hidden md:table-cell">Detalhe</th><th className="p-3 hidden lg:table-cell">IP</th><th className="p-3">Quando</th></tr>
          </thead>
          <tbody>
            {filtrados.map((l) => (
              <tr key={l.id} className="border-t dark:border-slate-700">
                <td className="p-3 font-medium">{nome(l.usuario_id)}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs">{l.acao}</span></td>
                <td className="p-3 hidden md:table-cell text-gray-500">{l.detalhe}</td>
                <td className="p-3 hidden lg:table-cell text-gray-500">{l.ip || '—'}</td>
                <td className="p-3 text-gray-500">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum log.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
