import { useEffect, useState } from 'react'
import { Megaphone, AlertTriangle, Users, MapPin, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'

export default function Avisos() {
  const { usuario } = useAuth()
  const { evento } = useEvento()
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [alvoTipo, setAlvoTipo] = useState('todos')
  const [alvoId, setAlvoId] = useState('')
  const [setores, setSetores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [historico, setHistorico] = useState([])
  const [enviando, setEnviando] = useState(false)

  async function carregar() {
    if (!evento) return
    const [{ data: st }, { data: us }, { data: av }] = await Promise.all([
      supabase.from('setores').select('id, codigo, nome').eq('evento_id', evento.id).or('tipo.is.null,tipo.eq.setor').order('codigo'),
      supabase.from('usuarios').select('id, nome, telefone').eq('ativo', true).order('nome'),
      supabase.from('avisos').select('*').eq('evento_id', evento.id).order('created_at', { ascending: false }).limit(30)
    ])
    setSetores(st || []); setUsuarios(us || []); setHistorico(av || [])
  }
  useEffect(() => { carregar() }, [evento])

  async function enviar(e) {
    e.preventDefault()
    if (!mensagem.trim()) return toast.error('Escreva a mensagem do aviso.')
    if (alvoTipo !== 'todos' && !alvoId) return toast.error('Escolha o destino (setor ou usuário).')
    setEnviando(true)
    const { error } = await supabase.from('avisos').insert({
      evento_id: evento.id, titulo: titulo.trim() || null, mensagem: mensagem.trim(),
      urgente, alvo_tipo: alvoTipo, alvo_id: alvoTipo === 'todos' ? null : alvoId,
      criado_por: usuario.id, nome_autor: usuario.nome
    })
    setEnviando(false)
    if (error) return toast.error('Erro ao enviar: ' + error.message)
    toast.success('Aviso enviado! O modal abre na hora para os destinatários.')
    setTitulo(''); setMensagem(''); setUrgente(false)
    carregar()
  }

  const nomeAlvo = (a) => {
    if (a.alvo_tipo === 'todos') return 'Todos'
    if (a.alvo_tipo === 'setor') { const s = setores.find((x) => x.id === a.alvo_id); return s ? `Setor ${s.codigo}` : 'Setor' }
    const u = usuarios.find((x) => x.id === a.alvo_id); return u ? u.nome : 'Usuário'
  }

  const opcoes = [
    { v: 'todos', label: 'Todos', icon: Users },
    { v: 'setor', label: 'Por setor', icon: MapPin },
    { v: 'usuario', label: 'Por usuário', icon: User }
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone size={26} /> Avisos do sistema</h1>

      <form onSubmit={enviar} className="card space-y-4">
        <div>
          <label className="label">Destinatários</label>
          <div className="grid grid-cols-3 gap-2">
            {opcoes.map(({ v, label, icon: Icon }) => (
              <button type="button" key={v} onClick={() => { setAlvoTipo(v); setAlvoId('') }}
                className={`btn ${alvoTipo === v ? 'btn-primary' : 'btn-ghost'} flex-col !min-h-[64px] gap-1`}>
                <Icon size={20} /> <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {alvoTipo === 'setor' && (
          <div>
            <label className="label">Setor</label>
            <select className="input" value={alvoId} onChange={(e) => setAlvoId(e.target.value)}>
              <option value="">Selecione…</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nome}</option>)}
            </select>
          </div>
        )}
        {alvoTipo === 'usuario' && (
          <div>
            <label className="label">Usuário</label>
            <select className="input" value={alvoId} onChange={(e) => setAlvoId(e.target.value)}>
              <option value="">Selecione…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}

        <div><label className="label">Título (opcional)</label>
          <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Início da contagem" />
        </div>
        <div><label className="label">Mensagem</label>
          <textarea className="input" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escreva o aviso…" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
          <span className="flex items-center gap-1 text-urgencia font-medium"><AlertTriangle size={16} /> Marcar como urgente (com som)</span>
        </label>

        <button disabled={enviando} className={`btn-lg w-full text-white ${urgente ? 'btn-urgencia' : 'btn-primary'}`}>
          {enviando ? 'Enviando…' : 'Enviar aviso'}
        </button>
      </form>

      <div className="card">
        <h2 className="font-semibold mb-3">Histórico</h2>
        {historico.length === 0 && <p className="text-gray-400 text-sm">Nenhum aviso enviado ainda.</p>}
        <div className="space-y-2">
          {historico.map((a) => (
            <div key={a.id} className={`rounded-lg border px-3 py-2 ${a.urgente ? 'border-urgencia/40 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{a.titulo || (a.urgente ? 'Alerta' : 'Aviso')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700">{nomeAlvo(a)}</span>
                {a.urgente && <span className="text-xs text-urgencia font-semibold">urgente</span>}
                <span className="ml-auto text-xs text-gray-400">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{a.mensagem}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
