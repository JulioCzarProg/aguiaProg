import { useEffect, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'
import Modal from '../../components/Modal'

const vazio = { titulo: '', descricao: '', data_hora: '', local: '' }

export default function Reunioes() {
  const { usuario } = useAuth()
  const { evento } = useEvento()
  const [reunioes, setReunioes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [participantes, setParticipantes] = useState({}) // reuniaoId -> [usuarioId]
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazio)
  const [selecionados, setSelecionados] = useState([])
  const [buscaPart, setBuscaPart] = useState('')

  async function carregar() {
    if (!evento) return
    const [{ data: rs }, { data: us }, { data: ps }] = await Promise.all([
      supabase.from('reunioes').select('*').eq('evento_id', evento.id).order('data_hora'),
      supabase.from('usuarios').select('id, nome, funcao').eq('ativo', true).order('nome'),
      supabase.from('reuniao_participantes').select('*')
    ])
    setReunioes(rs || []); setUsuarios(us || [])
    const mapa = {}
    ;(ps || []).forEach((p) => { (mapa[p.reuniao_id] ||= []).push(p.usuario_id) })
    setParticipantes(mapa)
  }
  useEffect(() => { carregar() }, [evento])

  function novo() { setEditando(null); setForm(vazio); setSelecionados([]); setModal(true) }
  function editar(r) {
    setEditando(r)
    setForm({ titulo: r.titulo, descricao: r.descricao || '', data_hora: r.data_hora?.slice(0, 16) || '', local: r.local || '' })
    setSelecionados(participantes[r.id] || [])
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.data_hora) return toast.error('Título e data/hora obrigatórios.')
    const dados = { ...form, evento_id: evento.id, data_hora: new Date(form.data_hora).toISOString(), criado_por: usuario.id }

    let reuniaoId = editando?.id
    if (editando) {
      await supabase.from('reunioes').update(dados).eq('id', editando.id)
      await supabase.from('reuniao_participantes').delete().eq('reuniao_id', editando.id)
    } else {
      const { data } = await supabase.from('reunioes').insert(dados).select().single()
      reuniaoId = data.id
    }
    if (selecionados.length) {
      await supabase.from('reuniao_participantes').insert(selecionados.map((uid) => ({ reuniao_id: reuniaoId, usuario_id: uid })))
    }

    // Aviso automático no chat (canal Geral)
    const { data: canal } = await supabase.from('canais').select('id').eq('evento_id', evento.id).eq('nome', 'Geral').maybeSingle()
    if (canal) {
      const quando = new Date(form.data_hora).toLocaleString('pt-BR')
      await supabase.from('mensagens').insert({
        canal_id: canal.id, usuario_id: usuario.id, nome_autor: usuario.nome, funcao_autor: usuario.funcao,
        tipo: 'texto', texto: `📅 Reunião: "${form.titulo}" em ${quando}${form.local ? ' • ' + form.local : ''}. ${selecionados.length} convidado(s).`
      })
    }
    toast.success('Reunião salva e avisada no chat!')
    setModal(false); carregar()
  }

  async function cancelar(r) {
    if (!confirm(`Cancelar a reunião "${r.titulo}"?`)) return
    await supabase.from('reunioes').delete().eq('id', r.id)
    toast.success('Reunião cancelada.'); carregar()
  }

  function toggle(uid) {
    setSelecionados((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid])
  }
  const nome = (id) => usuarios.find((u) => u.id === id)?.nome || ''
  const filtroUsuarios = usuarios.filter((u) => !buscaPart || u.nome.toLowerCase().includes(buscaPart.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold flex-1">Reuniões</h1>
        <button onClick={novo} className="btn-primary"><Plus size={16} /> Nova reunião</button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {reunioes.map((r) => (
          <div key={r.id} className="card">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-bold text-lg">{r.titulo}</h3>
                <p className="text-sm text-primary font-medium">{new Date(r.data_hora).toLocaleString('pt-BR')}</p>
                {r.local && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={14} /> {r.local}</p>}
              </div>
            </div>
            {r.descricao && <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{r.descricao}</p>}
            <p className="text-xs text-gray-400 mt-2">
              {(participantes[r.id] || []).length} participantes: {(participantes[r.id] || []).slice(0, 4).map(nome).join(', ')}
              {(participantes[r.id] || []).length > 4 && '…'}
            </p>
            <div className="flex gap-3 mt-2 text-sm">
              <button onClick={() => editar(r)} className="text-primary">Editar</button>
              <button onClick={() => cancelar(r)} className="text-urgencia">Cancelar</button>
            </div>
          </div>
        ))}
        {reunioes.length === 0 && <p className="text-gray-400">Nenhuma reunião agendada.</p>}
      </div>

      <Modal aberto={modal} titulo={editando ? 'Editar reunião' : 'Nova reunião'} onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-3">
          <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div><label className="label">Descrição</label><textarea className="input" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Data e hora</label><input type="datetime-local" className="input" value={form.data_hora} onChange={(e) => setForm({ ...form, data_hora: e.target.value })} /></div>
            <div><label className="label">Local</label><input className="input" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Participantes ({selecionados.length})</label>
            <input className="input mb-2" placeholder="Buscar…" value={buscaPart} onChange={(e) => setBuscaPart(e.target.value)} />
            <div className="max-h-40 overflow-y-auto border dark:border-slate-700 rounded-xl p-2 space-y-1">
              {filtroUsuarios.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" checked={selecionados.includes(u.id)} onChange={() => toggle(u.id)} />
                  {u.nome} <span className="text-xs text-gray-400 capitalize">{u.funcao}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full">{editando ? 'Salvar' : 'Agendar e avisar'}</button>
        </form>
      </Modal>
    </div>
  )
}
