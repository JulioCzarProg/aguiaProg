import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import { LISTA_CORES, corDe } from '../../components/cores'
import Modal from '../../components/Modal'

const vazio = { codigo: '', nome: '', descricao: '', cor: 'azul', capacidade: '' }

export default function Setores() {
  const { evento } = useEvento()
  const [setores, setSetores] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazio)

  async function carregar() {
    if (!evento) return
    const { data } = await supabase.from('setores').select('*').eq('evento_id', evento.id).or('tipo.is.null,tipo.eq.setor').order('codigo')
    setSetores(data || [])
  }
  useEffect(() => { carregar() }, [evento])

  function novo() { setEditando(null); setForm(vazio); setModal(true) }
  function editar(s) {
    setEditando(s)
    setForm({ codigo: s.codigo, nome: s.nome, descricao: s.descricao || '', cor: s.cor || 'azul', capacidade: s.capacidade ?? '' })
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nome.trim()) return toast.error('Código e nome são obrigatórios.')
    const dados = {
      evento_id: evento.id, codigo: form.codigo.trim(), nome: form.nome.trim(),
      descricao: form.descricao, cor: form.cor,
      capacidade: form.capacidade === '' ? null : Number(form.capacidade)
    }
    // posição padrão para novos setores (grade)
    if (!editando) {
      const i = setores.length
      dados.pos_x = 6 + (i % 4) * 23
      dados.pos_y = 14 + Math.floor(i / 4) * 16
      dados.largura = 18; dados.altura = 12
    }
    const { error } = editando
      ? await supabase.from('setores').update(dados).eq('id', editando.id)
      : await supabase.from('setores').insert(dados)
    if (error) return toast.error(error.message)
    toast.success('Salvo!'); setModal(false); carregar()
  }

  async function excluir(s) {
    if (!confirm(`Excluir setor ${s.codigo}?`)) return
    await supabase.from('setores').delete().eq('id', s.id)
    toast.success('Excluído.'); carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold flex-1">Setores</h1>
        <button onClick={novo} className="btn-primary">+ Novo setor</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {setores.map((s) => {
          const c = corDe(s.cor)
          return (
            <div key={s.id} className="rounded-xl border dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
              <div className="px-4 py-3 text-white flex items-center gap-2" style={{ background: c.bg }}>
                <span className="text-2xl font-extrabold">{s.codigo}</span>
                <span className="font-semibold flex-1 truncate">{s.nome}</span>
              </div>
              <div className="p-3 text-sm">
                {s.descricao && <p className="text-gray-500 mb-1">{s.descricao}</p>}
                <p className="text-gray-500">Capacidade: <b>{s.capacidade ?? '—'}</b></p>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => editar(s)} className="text-primary">Editar</button>
                  <button onClick={() => excluir(s)} className="text-urgencia">Excluir</button>
                </div>
              </div>
            </div>
          )
        })}
        {setores.length === 0 && <p className="text-gray-400">Nenhum setor cadastrado para este evento.</p>}
      </div>

      <Modal aberto={modal} titulo={editando ? 'Editar setor' : 'Novo setor'} onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Código</label><input className="input" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="A1" /></div>
            <div className="col-span-2"><label className="label">Nome</label><input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          </div>
          <div><label className="label">Descrição</label><input className="input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div><label className="label">Capacidade</label><input type="number" className="input" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} /></div>
          <div>
            <label className="label">Cor</label>
            <div className="flex flex-wrap gap-2">
              {LISTA_CORES.map((nome) => (
                <button type="button" key={nome} onClick={() => setForm({ ...form, cor: nome })}
                  className={`w-9 h-9 rounded-full border-2 ${form.cor === nome ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ background: corDe(nome).bg }} title={corDe(nome).label} />
              ))}
            </div>
          </div>
          <button className="btn-primary w-full">{editando ? 'Salvar' : 'Criar'}</button>
        </form>
      </Modal>
    </div>
  )
}
