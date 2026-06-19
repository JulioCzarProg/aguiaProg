import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import DragVoluntario from '../../components/DragVoluntario'
import ImportarDesignacoes from '../../components/ImportarDesignacoes'
import { corDe } from '../../components/cores'

const TURNOS = ['Sex Manhã', 'Sex Tarde', 'Sáb Manhã', 'Sáb Tarde', 'Dom Manhã', 'Dom Tarde']

export default function Programacao() {
  const { evento } = useEvento()
  const [usuarios, setUsuarios] = useState([])
  const [setores, setSetores] = useState([])
  const [areas, setAreas] = useState([])
  const [designacoes, setDesignacoes] = useState([])
  const [turno, setTurno] = useState(TURNOS[0])
  const [menu, setMenu] = useState(null) // {x,y,designacao}

  async function carregar() {
    if (!evento) return
    const [{ data: us }, { data: st }, { data: ar }, { data: ds }] = await Promise.all([
      supabase.from('usuarios').select('id, nome, congregacao, funcao').eq('ativo', true).order('nome'),
      supabase.from('setores').select('*').eq('evento_id', evento.id).or('tipo.is.null,tipo.eq.setor').order('codigo'),
      supabase.from('setores').select('*').eq('evento_id', evento.id).eq('tipo', 'area').order('codigo'),
      supabase.from('designacoes').select('*').eq('evento_id', evento.id)
    ])
    setUsuarios(us || []); setSetores(st || []); setAreas(ar || []); setDesignacoes(ds || [])
  }
  useEffect(() => { carregar() }, [evento])
  useEffect(() => {
    const fecha = () => setMenu(null)
    window.addEventListener('click', fecha)
    return () => window.removeEventListener('click', fecha)
  }, [])

  // designações do turno atual
  const noTurno = useMemo(() => designacoes.filter((d) => d.turno === turno), [designacoes, turno])
  const designadosIds = new Set(noTurno.map((d) => d.usuario_id))

  // quem está em 2+ setores no mesmo turno (amarelo)
  const contagemPorUsuario = {}
  noTurno.forEach((d) => { contagemPorUsuario[d.usuario_id] = (contagemPorUsuario[d.usuario_id] || 0) + 1 })

  // capitães NÃO entram no pool de setores (são designados por ÁREA)
  const disponiveis = usuarios.filter((u) => !designadosIds.has(u.id) && u.funcao !== 'capitao')
  const capitaes = usuarios.filter((u) => u.funcao === 'capitao')
  const capitaesDaArea = (areaId) => noTurno
    .filter((d) => d.setor_id === areaId)
    .map((d) => ({ ...d, usuario: usuarios.find((u) => u.id === d.usuario_id) }))
    .filter((x) => x.usuario)
  async function atribuirCapitao(areaId, usuarioId) {
    if (!usuarioId || noTurno.some((d) => d.setor_id === areaId && d.usuario_id === usuarioId)) return
    const { data } = await supabase.from('designacoes').insert({ evento_id: evento.id, usuario_id: usuarioId, setor_id: areaId, turno }).select().single()
    if (data) setDesignacoes((prev) => [...prev, data])
  }
  async function removerCapitao(d) {
    setDesignacoes((prev) => prev.filter((x) => x.id !== d.id))
    await supabase.from('designacoes').delete().eq('id', d.id)
  }
  const porSetor = (setorId) => noTurno
    .filter((d) => d.setor_id === setorId)
    .map((d) => ({ ...d, usuario: usuarios.find((u) => u.id === d.usuario_id) }))
    .filter((x) => x.usuario)

  async function handleDragEnd({ source, destination, draggableId }) {
    if (!destination) return
    const usuarioId = draggableId.replace('u-', '')
    const origem = source.droppableId
    const destino = destination.droppableId
    if (origem === destino) return

    // soltar em "disponiveis" => remover do setor
    if (destino === 'disponiveis') {
      const d = noTurno.find((x) => x.usuario_id === usuarioId && x.setor_id === origem)
      if (d) {
        setDesignacoes((prev) => prev.filter((x) => x.id !== d.id))
        await supabase.from('designacoes').delete().eq('id', d.id)
      }
      return
    }

    // soltar num setor
    if (origem === 'disponiveis') {
      const nova = { evento_id: evento.id, usuario_id: usuarioId, setor_id: destino, turno, data_designacao: new Date().toISOString().slice(0, 10) }
      const { data, error } = await supabase.from('designacoes').insert(nova).select().single()
      if (error) return toast.error('Erro ao designar.')
      setDesignacoes((prev) => [...prev, data])
    } else {
      // mover entre setores
      const d = noTurno.find((x) => x.usuario_id === usuarioId && x.setor_id === origem)
      if (d) {
        setDesignacoes((prev) => prev.map((x) => x.id === d.id ? { ...x, setor_id: destino } : x))
        await supabase.from('designacoes').update({ setor_id: destino }).eq('id', d.id)
      }
    }
  }

  async function copiarPara(designacao, outroTurno) {
    const existe = designacoes.find((d) => d.usuario_id === designacao.usuario_id && d.setor_id === designacao.setor_id && d.turno === outroTurno)
    if (existe) return toast('Já existe nesse turno.')
    const nova = { evento_id: evento.id, usuario_id: designacao.usuario_id, setor_id: designacao.setor_id, turno: outroTurno, data_designacao: new Date().toISOString().slice(0, 10) }
    const { data } = await supabase.from('designacoes').insert(nova).select().single()
    if (data) { setDesignacoes((prev) => [...prev, data]); toast.success(`Copiado para ${outroTurno}`) }
    setMenu(null)
  }
  async function remover(designacao) {
    setDesignacoes((prev) => prev.filter((x) => x.id !== designacao.id))
    await supabase.from('designacoes').delete().eq('id', designacao.id)
    setMenu(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Programação</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 hidden md:inline">Arraste os voluntários. Salva automaticamente.</span>
          <ImportarDesignacoes evento={evento} onConcluido={carregar} />
        </div>
      </div>

      {/* Abas de turno */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TURNOS.map((t) => (
          <button key={t} onClick={() => setTurno(t)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${t === turno ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border dark:border-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Capitães por ÁREA (o capitão é da área, não do setor) */}
      {areas.length > 0 && (
        <div className="card">
          <div className="font-semibold mb-2 text-sm">Capitães por área — {turno}</div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {areas.map((a) => (
              <div key={a.id} className="rounded-xl border dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-1.5 text-white text-sm font-bold flex items-center gap-2" style={{ background: corDe(a.cor).bg }}>
                  <span>Área {a.codigo}</span><span className="font-normal opacity-90 truncate">{a.nome}</span>
                </div>
                <div className="p-2 space-y-1">
                  {capitaesDaArea(a.id).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2 py-1">
                      <span className="flex-1 truncate">👤 {d.usuario.nome}</span>
                      <button onClick={() => removerCapitao(d)} className="text-urgencia text-xs">remover</button>
                    </div>
                  ))}
                  {capitaesDaArea(a.id).length === 0 && <div className="text-xs text-gray-400 px-1">sem capitão neste turno</div>}
                  <select className="input !min-h-[36px] text-sm" value="" onChange={(e) => atribuirCapitao(a.id, e.target.value)}>
                    <option value="">+ atribuir capitão…</option>
                    {capitaes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">O mesmo capitão pode cobrir mais de uma área e mais de um turno. Ele controla a equipe dos setores da área.</p>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Disponíveis */}
          <Droppable droppableId="disponiveis">
            {(prov, snap) => (
              <div ref={prov.innerRef} {...prov.droppableProps}
                className={`card !p-3 h-fit max-h-[70vh] overflow-y-auto ${snap.isDraggingOver ? 'ring-2 ring-primary' : ''}`}>
                <div className="font-semibold mb-2 text-sm">Disponíveis ({disponiveis.length})</div>
                <div className="space-y-2">
                  {disponiveis.map((u, i) => (
                    <Draggable key={u.id} draggableId={`u-${u.id}`} index={i}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                          <DragVoluntario voluntario={u} estado="disponivel" dragging={s.isDragging} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                </div>
              </div>
            )}
          </Droppable>

          {/* Setores */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {setores.map((setor) => {
              const lista = porSetor(setor.id)
              const c = corDe(setor.cor)
              return (
                <Droppable key={setor.id} droppableId={setor.id}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps}
                      className={`rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden ${snap.isDraggingOver ? 'ring-2 ring-primary' : ''}`}>
                      <div className="px-3 py-2 text-white flex items-center gap-2" style={{ background: c.bg }}>
                        <b>{setor.codigo}</b><span className="truncate flex-1">{setor.nome}</span>
                        <span className="text-xs bg-white/25 rounded-full px-2">{lista.length}{setor.capacidade ? `/${setor.capacidade}` : ''}</span>
                      </div>
                      <div className="p-2 space-y-2 min-h-[60px]">
                        {lista.map((d, i) => (
                          <Draggable key={d.id} draggableId={`u-${d.usuario_id}`} index={i}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, designacao: d }) }}>
                                <DragVoluntario voluntario={d.usuario}
                                  estado={contagemPorUsuario[d.usuario_id] > 1 ? 'duplo' : 'designado'} dragging={s.isDragging} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
            {setores.length === 0 && <p className="text-gray-400">Cadastre setores primeiro.</p>}
          </div>
        </div>
      </DragDropContext>

      {/* Menu de contexto */}
      {menu && (
        <div className="fixed z-50 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-lg py-1 text-sm w-56"
          style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1 text-xs text-gray-400">Copiar para outro turno:</div>
          {TURNOS.filter((t) => t !== turno).map((t) => (
            <button key={t} onClick={() => copiarPara(menu.designacao, t)}
              className="block w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700">→ {t}</button>
          ))}
          <div className="border-t dark:border-slate-700 my-1" />
          <button onClick={() => remover(menu.designacao)}
            className="block w-full text-left px-3 py-1.5 text-urgencia hover:bg-red-50 dark:hover:bg-red-900/30">Remover do setor</button>
        </div>
      )}

      {/* Legenda */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> designado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400" /> disponível</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500" /> em 2+ setores</span>
      </div>
    </div>
  )
}
