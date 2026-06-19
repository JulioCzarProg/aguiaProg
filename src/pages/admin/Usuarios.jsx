import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Download, UserPlus } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { soDigitos } from '../../contexts/AuthContext'
import { exportarCSV } from '../../lib/csv'
import Modal from '../../components/Modal'

const FUNCOES = ['voluntario', 'capitao', 'coordenador', 'admin']
const vazio = { nome: '', telefone: '', congregacao: '', funcao: 'voluntario', senha: '' }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')
  const [filtroCong, setFiltroCong] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazio)

  // Importação
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  async function carregar() {
    const { data } = await supabase.from('usuarios').select('*').order('nome')
    setUsuarios(data || [])
  }
  useEffect(() => { carregar() }, [])

  const congregacoes = useMemo(
    () => [...new Set(usuarios.map((u) => u.congregacao).filter(Boolean))].sort(), [usuarios])

  const filtrados = usuarios.filter((u) => {
    const t = busca.toLowerCase()
    return (!busca || u.nome?.toLowerCase().includes(t) || u.telefone?.includes(soDigitos(busca)))
      && (!filtroFuncao || u.funcao === filtroFuncao)
      && (!filtroCong || u.congregacao === filtroCong)
  })

  function abrirNovo() { setEditando(null); setForm(vazio); setModal(true) }
  function abrirEditar(u) {
    setEditando(u)
    setForm({ nome: u.nome, telefone: u.telefone, congregacao: u.congregacao || '', funcao: u.funcao, senha: '' })
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim() || soDigitos(form.telefone).length < 10)
      return toast.error('Preencha nome e WhatsApp válido.')
    const { senha, ...resto } = form
    const dados = { ...resto, telefone: soDigitos(form.telefone) }
    if (senha != null && senha !== '') dados.codigo_acesso = senha.trim() // ativa senha
    const { error } = editando
      ? await supabase.from('usuarios').update(dados).eq('id', editando.id)
      : await supabase.from('usuarios').insert(dados)
    if (error) return toast.error(error.message.includes('duplicate') ? 'Telefone já cadastrado.' : error.message)
    toast.success(editando ? 'Atualizado!' : 'Voluntário criado!')
    setModal(false); carregar()
  }

  async function mudarFuncao(u, funcao) {
    await supabase.from('usuarios').update({ funcao }).eq('id', u.id)
    toast.success(`${u.nome} agora é ${funcao}`)
    carregar()
  }
  async function alternarAtivo(u) {
    await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('id', u.id)
    carregar()
  }
  async function excluir(u) {
    if (!confirm(`Excluir ${u.nome}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('usuarios').delete().eq('id', u.id)
    toast.success('Excluído.'); carregar()
  }

  // ---- Importação de planilha ----
  function importarPlanilha(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      const mapeado = data.map((row, i) => {
        const get = (...keys) => { for (const k of keys) { const kk = Object.keys(row).find((x) => x.trim().toUpperCase() === k); if (kk) return row[kk] } return '' }
        const nome = String(get('VOLUNTÁRIO', 'VOLUNTARIO', 'NOME') || '').trim()
        const telefone = soDigitos(String(get('CONTATO', 'TELEFONE', 'WHATSAPP') || ''))
        const congregacao = String(get('CONGREGAÇÃO', 'CONGREGACAO') || '').trim()
        const setorCodigo = String(get('#', 'SETOR') || '').trim()
        const setorNome = String(get('SETORES', 'SETOR') || '').trim()
        const erros = []
        if (!nome) erros.push('sem nome')
        if (telefone.length < 10) erros.push('telefone inválido')
        return { linha: i + 2, nome, telefone, congregacao, setorCodigo, setorNome, erros }
      })
      setPreview(mapeado)
    }
    reader.readAsBinaryString(file)
  }

  async function confirmarImport() {
    const validos = preview.filter((p) => p.erros.length === 0)
    if (!validos.length) return toast.error('Nenhuma linha válida.')
    const payload = validos.map((v) => ({ nome: v.nome, telefone: v.telefone, congregacao: v.congregacao, funcao: 'voluntario' }))
    const { error, count } = await supabase.from('usuarios').upsert(payload, { onConflict: 'telefone', count: 'exact' })
    if (error) return toast.error('Erro: ' + error.message)
    toast.success(`${count ?? validos.length} voluntários importados!`)
    setPreview(null); carregar()
  }

  function exportar() {
    exportarCSV('voluntarios', filtrados.map((u) => ({
      nome: u.nome, telefone: u.telefone, congregacao: u.congregacao,
      funcao: u.funcao, ativo: u.ativo ? 'sim' : 'não',
      ultimo_acesso: u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : ''
    })))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold flex-1">Usuários</h1>
        <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={16} /> Importar planilha</button>
        <button onClick={exportar} className="btn-ghost"><Download size={16} /> Exportar CSV</button>
        <button onClick={abrirNovo} className="btn-primary"><UserPlus size={16} /> Novo voluntário</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => e.target.files[0] && importarPlanilha(e.target.files[0])} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[180px]" placeholder="Buscar nome ou telefone…"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input w-auto" value={filtroFuncao} onChange={(e) => setFiltroFuncao(e.target.value)}>
          <option value="">Todas funções</option>
          {FUNCOES.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
        </select>
        <select className="input w-auto" value={filtroCong} onChange={(e) => setFiltroCong(e.target.value)}>
          <option value="">Todas congregações</option>
          {congregacoes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/50 text-left">
            <tr>
              <th className="p-3">Nome</th><th className="p-3">Telefone</th>
              <th className="p-3 hidden md:table-cell">Congregação</th>
              <th className="p-3">Função</th><th className="p-3 hidden lg:table-cell">Último acesso</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => (
              <tr key={u.id} className={`border-t dark:border-slate-700 ${!u.ativo ? 'opacity-50' : ''}`}>
                <td className="p-3 font-medium">{u.nome}</td>
                <td className="p-3">{u.telefone}</td>
                <td className="p-3 hidden md:table-cell">{u.congregacao}</td>
                <td className="p-3">
                  <select value={u.funcao} onChange={(e) => mudarFuncao(u, e.target.value)}
                    className="bg-transparent border rounded-lg px-2 py-1 capitalize dark:border-slate-600">
                    {FUNCOES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </td>
                <td className="p-3 hidden lg:table-cell text-gray-500">
                  {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => abrirEditar(u)} className="text-primary mr-2">Editar</button>
                  <button onClick={() => alternarAtivo(u)} className="text-amber-600 mr-2">{u.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => excluir(u)} className="text-urgencia">Excluir</button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhum usuário.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">{filtrados.length} de {usuarios.length} usuários</p>

      {/* Modal novo/editar */}
      <Modal aberto={modal} titulo={editando ? 'Editar voluntário' : 'Novo voluntário'} onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-3">
          <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><label className="label">WhatsApp (com DDD)</label><input className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="38999999999" /></div>
          <div><label className="label">Congregação</label><input className="input" value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })} /></div>
          <div><label className="label">Função</label>
            <select className="input capitalize" value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })}>
              {FUNCOES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Senha de acesso (opcional)</label>
            <input className="input" type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={editando ? 'deixe em branco para não alterar' : 'sem senha = acesso por telefone'} />
            <p className="text-[11px] text-gray-400 mt-1">Admin entra com senha. Se definir senha para capitão/voluntário, ele passa a entrar com senha em vez do padrão (telefone/desafio).</p>
          </div>
          <button className="btn-primary w-full">{editando ? 'Salvar' : 'Criar'}</button>
        </form>
      </Modal>

      {/* Modal preview importação */}
      <Modal aberto={!!preview} titulo="Pré-visualização da importação" largura="max-w-3xl" onFechar={() => setPreview(null)}>
        {preview && (
          <>
            <div className="flex gap-3 mb-3 text-sm">
              <span className="text-green-600 font-semibold">{preview.filter((p) => !p.erros.length).length} válidos</span>
              <span className="text-urgencia font-semibold">{preview.filter((p) => p.erros.length).length} com erro</span>
            </div>
            <div className="max-h-72 overflow-y-auto border rounded-xl dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/50 sticky top-0">
                  <tr><th className="p-2 text-left">Linha</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Telefone</th><th className="p-2 text-left">Congregação</th><th className="p-2 text-left">Setor</th><th className="p-2 text-left">Status</th></tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.linha} className={`border-t dark:border-slate-700 ${p.erros.length ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                      <td className="p-2">{p.linha}</td><td className="p-2">{p.nome}</td><td className="p-2">{p.telefone}</td>
                      <td className="p-2">{p.congregacao}</td><td className="p-2">{p.setorCodigo} {p.setorNome}</td>
                      <td className="p-2">{p.erros.length ? <span className="text-urgencia">{p.erros.join(', ')}</span> : <span className="text-green-600">ok</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPreview(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={confirmarImport} className="btn-primary flex-1">Confirmar importação</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
