import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Send, ArrowLeft, PenSquare, Users, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'
import { useChat } from '../../hooks/useChat'
import ChatBubble from '../../components/ChatBubble'
import ConversaItem from '../../components/ConversaItem'
import AudioRecorder from '../../components/AudioRecorder'
import Modal from '../../components/Modal'

const NIVEL = { voluntario: 0, capitao: 1, coordenador: 2, admin: 3 }

const TURNOS = ['Sex Manhã', 'Sex Tarde', 'Sáb Manhã', 'Sáb Tarde', 'Dom Manhã', 'Dom Tarde']

async function garantirCanais(eventoId) {
  const { data: existentes } = await supabase.from('canais').select('nome').eq('evento_id', eventoId)
  const nomes = new Set((existentes || []).map((c) => c.nome))
  const base = [
    { nome: 'Geral', nivel_minimo: 'voluntario' },
    { nome: 'Capitães', nivel_minimo: 'capitao' },               // todos os capitães + coordenadores
    { nome: 'Coordenadores', nivel_minimo: 'coordenador' }
  ]
  // canal por turno só de capitães
  const capTurno = TURNOS.map((t) => ({ nome: `Capitães ${t}`, nivel_minimo: 'capitao', grupo: `TURNO:${t}` }))
  // equipe por área (setores agrupados pela descrição = nome da área)
  const { data: setores } = await supabase.from('setores').select('descricao').eq('evento_id', eventoId).or('tipo.is.null,tipo.eq.setor')
  const grupos = [...new Set((setores || []).map((s) => s.descricao).filter(Boolean))]
  const equipes = grupos.map((g) => ({ nome: `Equipe: ${g}`, nivel_minimo: 'voluntario', grupo: g }))
  const faltando = [...base, ...capTurno, ...equipes].filter((c) => !nomes.has(c.nome)).map((c) => ({ ...c, evento_id: eventoId, tipo: 'grupo' }))
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
  const [grupoModal, setGrupoModal] = useState(false)
  const [grupoNome, setGrupoNome] = useState('')
  const [grupoMembros, setGrupoMembros] = useState([])
  const [texto, setTexto] = useState('')
  const [urgente, setUrgente] = useState(false)
  const fileRef = useRef(null)
  const fimRef = useRef(null)
  const autoSelecionado = useRef(false)

  const { mensagens, enviarTexto, enviarArquivo, apagarMensagem } = useChat(canalId)
  const conv = convs.find((c) => c.id === canalId)
  const podeApagarTudo = temNivel('coordenador') // coordenador/admin apaga qualquer mensagem/conversa

  // apaga a conversa (para todos). DM: remove o canal (some da lista). Grupo: limpa as mensagens.
  async function apagarConversa(c) {
    await supabase.from('mensagens').delete().eq('canal_id', c.id)
    if (c.dm) await supabase.from('canais').delete().eq('id', c.id)
    if (canalId === c.id) setCanalId(null)
    setConvs((cs) => cs.filter((x) => x.id !== c.id))
    toast.success(c.dm ? 'Conversa apagada.' : 'Conversa limpa.')
    carregar()
  }

  const carregar = useCallback(async () => {
    if (!evento) return
    if (admin) await garantirCanais(evento.id)
    const [{ data: us }, { data: des }, { data: canais }] = await Promise.all([
      supabase.from('usuarios').select('id, nome, telefone, funcao, congregacao').eq('ativo', true).order('nome'),
      supabase.from('designacoes').select('turno, setores(descricao)').eq('usuario_id', usuario.id).eq('evento_id', evento.id),
      supabase.from('canais').select('*').eq('evento_id', evento.id)
    ])
    setUsuarios(us || [])
    const meusGrupos = new Set((des || []).map((d) => d.setores?.descricao).filter(Boolean))
    const meusTurnos = new Set((des || []).map((d) => d.turno).filter(Boolean))
    const nivel = NIVEL[usuario.funcao] ?? 0
    const visiveis = (canais || []).filter((c) => {
      if (c.tipo === 'dm') return (c.participantes || []).includes(usuario.id)
      // grupo personalizado (com membros definidos): só os membros (ou admin)
      if (c.participantes && c.participantes.length) return admin || c.participantes.includes(usuario.id)
      if (admin) return true
      if (nivel < (NIVEL[c.nivel_minimo] ?? 0)) return false
      if (c.grupo) {
        // canal de capitães por turno: capitão vê os seus turnos; coordenador+ vê todos
        if (c.grupo.startsWith('TURNO:')) return nivel >= NIVEL.coordenador || (nivel >= NIVEL.capitao && meusTurnos.has(c.grupo.slice(6)))
        // canal de equipe (área): vê só a sua área; coordenador+ vê todas
        return meusGrupos.has(c.grupo) || nivel >= NIVEL.coordenador
      }
      return true // Geral / Capitães (geral) / Coordenadores — já filtrados por nível
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
    // DM só aparece se tiver mensagem (conversa em branco não fica na lista)
    const visiveisLista = lista.filter((c) => !c.dm || c.ultima)
    visiveisLista.sort((a, b) => new Date(b.ultimaEm) - new Date(a.ultimaEm))
    setConvs(visiveisLista)
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

  // cria um grupo personalizado com membros escolhidos (coordenador/admin)
  async function criarGrupo() {
    if (!grupoNome.trim()) return toast.error('Dê um nome ao grupo.')
    if (grupoMembros.length === 0) return toast.error('Selecione ao menos um membro.')
    const membros = [...new Set([usuario.id, ...grupoMembros])]
    const { data, error } = await supabase.from('canais').insert({
      evento_id: evento.id, tipo: 'grupo', nome: grupoNome.trim(), nivel_minimo: 'voluntario', participantes: membros
    }).select().single()
    if (error) return toast.error('Erro: ' + error.message)
    setGrupoModal(false); setGrupoNome(''); setGrupoMembros([])
    await carregar(); if (data) setCanalId(data.id)
    toast.success('Grupo criado!')
  }
  const toggleMembro = (id) => setGrupoMembros((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id])

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
          {temNivel('coordenador') && (
            <button onClick={() => { setGrupoModal(true); setGrupoNome(''); setGrupoMembros([]); setBuscaPicker('') }} className="text-primary" aria-label="Novo grupo" title="Novo grupo"><Users size={20} /></button>
          )}
          {temNivel('capitao') && (
            <button onClick={() => { setPicker(true); setBuscaPicker('') }} className="text-primary" aria-label="Nova conversa" title="Nova conversa"><PenSquare size={20} /></button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.map((c) => (
            <ConversaItem key={c.id} conv={c} ativo={c.id === canalId}
              onAbrir={setCanalId} horaCurta={horaCurta} previa={previa}
              onApagar={podeApagarTudo ? apagarConversa : undefined} />
          ))}
          {convs.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Nenhuma conversa.</p>}
          {podeApagarTudo && convs.length > 0 && (
            <p className="text-center text-[11px] text-gray-400 mt-2 px-2">Arraste uma conversa para a esquerda para apagar.</p>
          )}
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
            {mensagens.map((m) => <ChatBubble key={m.id} msg={m} proprio={m.usuario_id === usuario.id}
              podeApagarTudo={podeApagarTudo} onApagar={apagarMensagem} />)}
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

      {/* Novo grupo (coordenador/admin) */}
      <Modal aberto={grupoModal} titulo="Novo grupo" onFechar={() => setGrupoModal(false)}>
        <div className="space-y-3">
          <div><label className="label">Nome do grupo</label>
            <input className="input" value={grupoNome} onChange={(e) => setGrupoNome(e.target.value)} placeholder="Ex.: Limpeza, Som, Líderes" /></div>
          <div>
            <label className="label">Membros ({grupoMembros.length})</label>
            <input className="input mb-2" placeholder="Buscar pessoa…" value={buscaPicker} onChange={(e) => setBuscaPicker(e.target.value)} />
            <div className="max-h-64 overflow-y-auto border dark:border-slate-700 rounded-xl p-1">
              {candidatos.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="checkbox" checked={grupoMembros.includes(u.id)} onChange={() => toggleMembro(u.id)} />
                  <span className="flex-1 truncate text-sm">{u.nome} <span className="text-xs text-gray-400 capitalize">{u.funcao}</span></span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={criarGrupo} className="btn-primary w-full">Criar grupo</button>
        </div>
      </Modal>
    </div>
  )
}
