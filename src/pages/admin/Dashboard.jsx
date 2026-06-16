import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import { useRealtime } from '../../hooks/useRealtime'
import MapaEvento from '../../components/MapaEvento'

function Card({ titulo, valor, cor, sub }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{titulo}</div>
      <div className="text-3xl font-extrabold" style={{ color: cor }}>{valor}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { evento } = useEvento()
  const [setores, setSetores] = useState([])
  const [locs, setLocs] = useState([])
  const [stats, setStats] = useState({ designados: 0, contagem: 0 })
  const [porTurno, setPorTurno] = useState([])
  const [alertas, setAlertas] = useState([])

  async function carregar() {
    if (!evento) return
    const [{ data: st }, { data: lc }, { count: desig }, { data: cont }, { data: des }, { data: urg }] =
      await Promise.all([
        supabase.from('setores').select('*').eq('evento_id', evento.id),
        supabase.from('localizacoes').select('usuario_id, setor_id, updated_at'),
        supabase.from('designacoes').select('id', { count: 'exact', head: true }).eq('evento_id', evento.id),
        supabase.from('contagens').select('quantidade').eq('evento_id', evento.id),
        supabase.from('designacoes').select('turno').eq('evento_id', evento.id),
        supabase.from('mensagens').select('id, texto, nome_autor, created_at, canais!inner(evento_id)')
          .eq('urgente', true).eq('canais.evento_id', evento.id)
          .order('created_at', { ascending: false }).limit(8)
      ])
    setSetores(st || [])
    setLocs(lc || [])
    const totalCont = (cont || []).reduce((s, c) => s + (c.quantidade || 0), 0)
    setStats({ designados: desig || 0, contagem: totalCont })
    const grupos = {}
    ;(des || []).forEach((d) => { grupos[d.turno || 'Sem turno'] = (grupos[d.turno || 'Sem turno'] || 0) + 1 })
    setPorTurno(Object.entries(grupos).map(([turno, qtd]) => ({ turno, qtd })))
    setAlertas(urg || [])
  }

  useEffect(() => { carregar() }, [evento])
  useRealtime('localizacoes', { onInsert: carregar, onUpdate: carregar })
  useRealtime('mensagens', { onInsert: (m) => m.urgente && carregar() })

  const online = locs.filter((l) => (Date.now() - new Date(l.updated_at).getTime()) < 5 * 60 * 1000).length
  const maxTurno = Math.max(1, ...porTurno.map((p) => p.qtd))

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card titulo="Voluntários online" valor={online} cor="#3B6D11" sub="ativos < 5 min" />
        <Card titulo="Total designados" valor={stats.designados} cor="#185FA5" />
        <Card titulo="Contagem total" valor={stats.contagem} cor="#0d4178" sub="soma do evento" />
        <Card titulo="Alertas ativos" valor={alertas.length} cor="#A32D2D" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="font-semibold mb-3">Designações por turno</div>
          {porTurno.length === 0 && <p className="text-gray-400 text-sm">Sem designações.</p>}
          <div className="space-y-2">
            {porTurno.map((p) => (
              <div key={p.turno}>
                <div className="flex justify-between text-sm mb-0.5"><span>{p.turno}</span><span className="font-semibold">{p.qtd}</span></div>
                <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(p.qtd / maxTurno) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-3">Alertas urgentes recentes</div>
          {alertas.length === 0 && <p className="text-gray-400 text-sm">Nenhum alerta.</p>}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {alertas.map((a) => (
              <div key={a.id} className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm">
                <div className="font-semibold text-urgencia">{a.nome_autor}</div>
                <div>{a.texto}</div>
                <div className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Mapa ao vivo</div>
        <div className="max-w-2xl mx-auto aspect-square">
          <MapaEvento evento={evento} setores={setores} locs={locs} planta />
        </div>
      </div>
    </div>
  )
}
