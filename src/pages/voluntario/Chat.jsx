import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Send, ArrowLeft, PenSquare, Users, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'
import { useChat } from '../../hooks/useChat'
import ChatBubble from '../../components/ChatBubble'
import AudioRecorder from '../../components/AudioRecorder'
import Modal from '../../components/Modal'

const NIVEL = { voluntario: 0, capitao: 1, coordenador: 2, admin: 3 }

async function garantirCanais(eventoId) {
  const { data: existentes } = await supabase.from('canais').select('nome').eq('evento_id', eventoId)
  const nomes = new Set((existentes || []).map((c) => c.nome))
  const base = [
    { nome: 'Geral', nivel_minimo: 'voluntario' },
    { nome: 'Capitães', nivel_minimo: 'capitao' },
    { nome: 'Coordenadores', nivel_minimo: 'coordenador' }
  ]
  const { data: setores } = await supabase.from('setores').select('descricao').eq('evento_id', eventoId).or('tipo.is.null,tipo.eq.setor')
  const grupos = [...new Set((setores || []).map((s) => s.descricao).filter(Boolean))]
  const equipes = grupos.map((g) => ({ nome: `Equipe: ${g}`, nivel_minimo: 'voluntario', grupo: g }))
  const faltando = [...base, ...equipes].filter((c) => !nomes.has(c.nome)).map((c) => ({ ...c, evento_id: eventoId, tipo: 'grupo' }))
  if (faltando.length) await supabase.from('canais').insert(faltando)
}

function horaCurta(d) {
  if (!d) return ''
  const dt = new Date(d), hoje = new Date()
  if (dt.toDateString() === hoje.toDateString()) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function Chat({ admin = false }) {
  const { usuario, temNivel } = useAuth()
  const { evento } = useEvento()
  const [convs, setConvs] = useState([])
  const [canalId, setCanalId] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [picker, setPicker] = useState(false)
  const [buscaPicker, setBuscaPicker] = useState('')
  const [texto, setTexto] = useState('')
  const [urgente, setUrgente] = useState(false)
  const fileRef = useRef(null)
  const fimRef = useRef(null)
  const autoSelecionado = useRef(false)

  const { mensagens, enviarTexto, enviarArquivo } = useChat(canalId)
  const conv = convs.find((c) => c.id === canalId)

  const carregar = useCallback(async () => {
    if (!evento) return
    if (admin) await garantirCanais(evento.id)
    const [{ data: us }, { data: des }, { data: canais }] = await Promise.all([
      supabase.from('usuarios').select('id, nome, telefone, funcao, congregacao').eq('ativo', true).order('nome'),
      supabase.from('designacoes').select('setores(descricao)').eq('usuario_id', usuario.id).eq('evento_id', evento.id),
      supabase.from('canais').select('*').eq('evento_id', evento.id)
    ])
    setUsuarios(us || [])
    const meusGrupos = new Set((des || []).map((d) => d.setores?.descricao).filter(Boolean))
    const nivel = NIVEL[usuario.funcao] ?? 0
    const visiveis = (canais || []).filter((c) => {
      if (c.tipo === 'dm') return (c.participantes || []).includes(usuario.id)
      if (admin) return true
      if (nivel < (NIVEL[c.nivel_minimo] ?? 0)) return false
      if (c.grupo) return meusGrupos.has(c.grupo) || nivel >= NIVEL.capitao
      return true
    })
    // metadados (última mensagem + não lidas)
    const lista = await Promise.all(visiveis.map(async (c) => {
      const lido = Number(localStorage.getItem('chat_lido_' + c.id) || 0)
      const [{ data: lm }, { count }] = await Promise.all([
        supabase.from('mensagens').select('texto, tipo, created_at, nome_autor, usuario_id').eq('canal_id', c.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('mensagens').select('id', { count: 'exact', head: true }).eq('canal_id', c.id).gt('created_at', new Date(lido).toISOString()).neq('usuario_id', usuario.id)
      ])
      const ult = lm?.[0]
      let nome = c.nome, dm = c.tipo === 'dm'
      if (dm) { const outro = (c.participantes || []).find((id) => id !== usuario.id); nome = (us || []).find((u) => u.id === outro)?.nome || 'Conversa' }
      return { id: c.id, nome, dm, grupo: c.grupo, ultima: ult, ultimaEm: ult?.created_at || c.created_at, naoLidas: count || 0 }
    }))
    lista.sort((a, b) => new Date(b.ultimaEm) - new Date(a.ultimaEm))
    setConvs(lista)
    if (!autoSelecionado.current && !admin) {
      autoSelecionado.current = true
      const naoLida = lista.find((c) => c.naoLidas > 0)
      if (naoLida) setCanalId(naoLida.id)
    }
  }, [evento, usuario.id, usuario.funcao, admin])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const ch = supabase.channel('chat-lista').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, () => carregar()).subscribe()
    return () => supabase.removeChannel(ch)
  }, [carregar])

  // ao abrir conversa: marca lida e rola para o fim (última = não lida)
  useEffect(() => {
    if (!canalId) return
    localStorage.setItem('chat_lido_' + canalId, String(Date.now()))
    setConvs((cs) => cs.map((c) => c.id === canalId ? { ...c, naoLidas: 0 } : c))
  }, [canalId, mensagens.length])
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'auto' }) }, [mensagens, canalId])

  async function enviar() {
    if (!texto.trim()) return
    const t = texto; setTexto(''); const u = urgente; setUrgente(false)
    try { await enviarTexto(t, u) } catch { toast.error('Falha ao enviar.'); setTexto(t) }
  }
  async function escolherFoto(e) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    const p = toast.loading('Enviando foto…')
    try { await enviarArquivo(file, 'imagem'); toast.success('Foto enviada!', { id: p }) } catch { toast.error('Falha no envio.', { id: p }) }
  }
  async function audioPronto(blob, dur) {
    const p = toast.loading('Enviando áudio…')
    try { await enviarArquivo(new File([blob], 'audio.webm', { type: 'audio/webm' }), 'audio', { duracao_audio: dur }); toast.success('Áudio enviado!', { id: p }) } catch { toast.error('Falha no envio.', { id: p }) }
  }

  // abre (ou cria) conversa individual
  async function abrirDM(outro) {
    setPicker(false)
    const { data: existentes } = await supabase.from('canais').select('*').eq('evento_id', evento.id).eq('tipo', 'dm').contains('participantes', [usuario.id, outro.id])
    let canal = (existentes || [])[0]
    if (!canal) {
      const { data } = await supabase.from('canais').insert({ evento_id: evento.id, tipo: 'dm', nome: '', participantes: [usuario.id, outro.id] }).select().single()
      canal = data
    }
    await carregar()
    setCanalId(canal.id)
  }

  // candidatos para nova conversa: admin/coord = todos; capitão = sua equipe
  const candidatos = usuarios.filter((u) => u.id !== usuario.id &&
    (temNivel('coordenador') || true) && // capitães e acima podem iniciar
    (!buscaPicker || u.nome.toLowerCase().includes(buscaPicker.toLowerCase())))

  const previa = (m) => !m ? 'Sem mensagens' : m.tipo === 'imagem' ? '📷 Foto' : m.tipo === 'audio' ? '🎤 Áudio' : (m.texto || '')

  return (
    <div className={`flex ${admin ? 'h-[calc(100vh-160px)] max-w-4xl rounded-xl border dark:border-slate-700 overflow-hidden' : 'h-[calc(100vh-64px-80px)]'} mx-auto bg-white dark:bg-slate-800`}>
      {/* Lista de conversas */}
      <div className={`${canalId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r dark:border-slate-700 shrink-0`}>
        <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-slate-700">
          <span className="font-bold flex-1">Conversas</span>
          {temNivel('capitao') && (
            <button onClick={() => { setPicker(true); setBuscaPicker('') }} className="text-primary" aria-label="Nova conversa"><PenSquare size={20} /></button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.map((c) => (
            <button key={c.id} onClick={() => setCanalId(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b dark:border-slate-700/50 ${c.id === canalId ? 'bg-blue-50 dark:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <div className={`w-10 h-10 rounded-full grid place-items-center text-white shrink-0 ${c.dm ? 'bg-secundaria' : 'bg-primary'}`}>
                {c.dm ? <User size={18} /> : <Users size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate flex-1">{c.nome}</span>
                  <span className="text-[11px] text-gray-400">{horaCurta(c.ultimaEm)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 truncate flex-1">{c.ultima?.nome_autor ? `${c.ultima.nome_autor.split(' ')[0]}: ` : ''}{previa(c.ultima)}</span>
                  {c.naoLidas > 0 && <span className="bg-secundaria text-white text-[11px] rounded-full min-w-[20px] h-5 grid place-items-center px-1">{c.naoLidas}</span>}
                </div>
              </div>
            </button>
          ))}
          {convs.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Nenhuma conversa.</p>}
        </div>
      </div>

      {/* Conversa aberta */}
      <div className={`${canalId ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
        {!conv && <div className="flex-1 grid place-items-center text-gray-400">Selecione uma conversa</div>}
        {conv && <>
          <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <button onClick={() => setCanalId(null)} className="md:hidden" aria-label="Voltar"><ArrowLeft size={22} /></button>
            <div className={`w-9 h-9 rounded-full grid place-items-center text-white ${conv.dm ? 'bg-secundaria' : 'bg-primary'}`}>
              {conv.dm ? <User size={16} /> : <Users size={16} />}
            </div>
            <span className="font-bold truncate">{conv.nome}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-slate-900/30">
            {mensagens.length === 0 && <p className="text-center text-gray-400 mt-8">Sem mensagens.</p>}
            {mensagens.map((m) => <ChatBubble key={m.id} msg={m} proprio={m.usuario_id === usuario.id} />)}
            <div ref={fimRef} />
          </div>

          <div className="border-t dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
            {!conv.dm && (
              <label className="flex items-center gap-2 text-xs text-gray-500 px-1 mb-1">
                <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
                Marcar como <span className="text-urgencia font-semibold">urgente</span>
              </label>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={escolherFoto} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="btn w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 shrink-0" aria-label="Foto"><Camera size={22} /></button>
              <textarea value={texto} rows={1} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Mensagem…" className="input flex-1 !min-h-[48px] resize-none py-3" />
              {texto.trim()
                ? <button onClick={enviar} className="btn w-12 h-12 rounded-full bg-primary text-white shrink-0" aria-label="Enviar"><Send size={20} /></button>
                : <AudioRecorder onGravado={audioPronto} />}
            </div>
          </div>
        </>}
      </div>

      {/* Picker de nova conversa */}
      <Modal aberto={picker} titulo="Nova conversa" onFechar={() => setPicker(false)}>
        <input className="input mb-3" placeholder="Buscar pessoa…" value={buscaPicker} onChange={(e) => setBuscaPicker(e.target.value)} />
        <div className="max-h-80 overflow-y-auto -mx-1">
          {candidatos.map((u) => (
            <button key={u.id} onClick={() => abrirDM(u)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-left">
              <div className="w-9 h-9 rounded-full bg-secundaria text-white grid place-items-center"><User size={16} /></div>
              <div className="min-w-0">
                <div className="font-medium truncate">{u.nome}</div>
                <div className="text-xs text-gray-400 capitalize">{u.funcao}{u.congregacao ? ` • ${u.congregacao}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
