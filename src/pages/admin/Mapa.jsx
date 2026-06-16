import { useEffect, useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import { useRealtime } from '../../hooks/useRealtime'
import MapaGinasio from '../../components/MapaGinasio'
import MapaEvento from '../../components/MapaEvento'

export default function Mapa() {
  const { evento } = useEvento()
  const [setores, setSetores] = useState([])
  const [designacoes, setDesignacoes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [locs, setLocs] = useState([])
  const [sel, setSel] = useState(null)
  const [editar, setEditar] = useState(false)
  const [camada, setCamada] = useState(1)

  const [contagens, setContagens] = useState([])

  async function carregar() {
    if (!evento) return
    const [{ data: st }, { data: ds }, { data: us }, { data: lc }, { data: ct }] = await Promise.all([
      supabase.from('setores').select('*').eq('evento_id', evento.id),
      supabase.from('designacoes').select('usuario_id, setor_id, turno').eq('evento_id', evento.id),
      supabase.from('usuarios').select('id, nome, telefone, funcao'),
      supabase.from('localizacoes').select('usuario_id, setor_id, updated_at'),
      supabase.from('contagens').select('usuario_id, setor_id, quantidade, created_at').eq('evento_id', evento.id).order('created_at', { ascending: false })
    ])
    setSetores(st || []); setDesignacoes(ds || []); setUsuarios(us || []); setLocs(lc || []); setContagens(ct || [])
  }
  useEffect(() => { carregar() }, [evento])
  useRealtime('localizacoes', { onInsert: carregar, onUpdate: carregar })

  const nome = (id) => usuarios.find((u) => u.id === id)?.nome || '—'

  // presenças enriquecidas para o mapa (popup com mensagem/ligar/contagem)
  const capitaoDoSetor = (setorId) => {
    const d = designacoes.find((x) => x.setor_id === setorId && usuarios.find((u) => u.id === x.usuario_id)?.funcao === 'capitao')
    return d ? nome(d.usuario_id) : null
  }
  const presencasMapa = locs.filter((l) => l.setor_id).map((l) => {
    const s = setores.find((x) => x.id === l.setor_id); if (!s) return null
    const u = usuarios.find((x) => x.id === l.usuario_id)
    const ct = contagens.find((c) => c.usuario_id === l.usuario_id && c.setor_id === l.setor_id)
    return {
      id: l.usuario_id, codigo: s.codigo, setorNome: s.nome, nome: u?.nome, telefone: u?.telefone,
      capitao: capitaoDoSetor(l.setor_id), contagem: ct?.quantidade,
      atrasado: (Date.now() - new Date(l.updated_at).getTime()) > 5 * 60 * 1000
    }
  }).filter(Boolean)

  function mover(id, x, y) {
    setSetores((prev) => prev.map((s) => s.id === id ? { ...s, pos_x: x, pos_y: y } : s))
  }
  async function salvarPosicoes() {
    await Promise.all(setores.map((s) =>
      supabase.from('setores').update({ pos_x: s.pos_x, pos_y: s.pos_y, largura: s.largura, altura: s.altura }).eq('id', s.id)))
    toast.success('Layout do mapa salvo!')
    setEditar(false)
  }

  const ehCongresso = evento?.tipo === 'congresso'
  const designadosSel = sel ? designacoes.filter((d) => d.setor_id === sel.id) : []
  const presentesSel = sel ? locs.filter((l) => l.setor_id === sel.id) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">Mapa — {evento?.tipo}</h1>
        {ehCongresso && (
          <div className="flex rounded-xl overflow-hidden border dark:border-slate-700">
            <button onClick={() => setCamada(1)} className={`px-3 py-2 text-sm ${camada === 1 ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800'}`}>Camada 1</button>
            <button onClick={() => setCamada(2)} className={`px-3 py-2 text-sm ${camada === 2 ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800'}`}>Camada 2</button>
            <button onClick={() => setCamada('all')} className={`px-3 py-2 text-sm ${camada === 'all' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800'}`}>Tudo</button>
          </div>
        )}
        {ehCongresso
          ? <button onClick={() => setEditar((v) => !v)} className={editar ? 'btn-secundaria' : 'btn-ghost'}>
              {editar ? <><Save size={16} /> Concluir</> : <><Pencil size={16} /> Editar mapa</>}
            </button>
          : (editar
            ? <button onClick={salvarPosicoes} className="btn-secundaria"><Save size={16} /> Salvar layout</button>
            : <button onClick={() => setEditar(true)} className="btn-ghost"><Pencil size={16} /> Editar mapa</button>)}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="card aspect-square">
          {editar && !ehCongresso
            ? <MapaGinasio setores={setores} pontos={[]} setorSelecionado={sel?.id}
                editavel onMover={mover} />
            : <MapaEvento evento={evento} setores={setores} locs={locs}
                editavel={ehCongresso && editar} camada={camada} recarregar={carregar}
                presencas={ehCongresso && !editar ? presencasMapa : undefined}
                onUserClick={ehCongresso && !editar ? () => {} : undefined}
                setorSelecionado={sel?.id} onSetorClick={setSel} />}
        </div>

        <div className="card">
          {editar && <p className="text-sm text-amber-600 mb-2">Arraste os setores para reposicionar e clique em salvar.</p>}
          {!sel && !editar && <p className="text-gray-400 text-sm">Clique num setor para ver os detalhes.</p>}
          {sel && (
            <>
              <h3 className="font-bold text-lg">{sel.codigo} • {sel.nome}</h3>
              <div className="mt-3">
                <div className="text-sm font-semibold text-secundaria">Presentes agora ({presentesSel.length})</div>
                <ul className="text-sm text-gray-600 dark:text-slate-300 list-disc pl-5">
                  {presentesSel.map((p) => <li key={p.usuario_id}>{nome(p.usuario_id)}</li>)}
                  {presentesSel.length === 0 && <li className="list-none text-gray-400">ninguém marcou presença</li>}
                </ul>
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold text-primary">Designados ({designadosSel.length})</div>
                <ul className="text-sm text-gray-600 dark:text-slate-300 list-disc pl-5 max-h-48 overflow-y-auto">
                  {designadosSel.map((d, i) => <li key={i}>{nome(d.usuario_id)} <span className="text-gray-400">({d.turno})</span></li>)}
                  {designadosSel.length === 0 && <li className="list-none text-gray-400">nenhum designado</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
