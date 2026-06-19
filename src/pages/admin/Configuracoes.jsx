import { useEffect, useState } from 'react'
import { Sun, Moon, Save, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useEvento } from '../../contexts/EventoContext'
import { baixarJSON } from '../../lib/csv'
import FotoUpload from '../../components/FotoUpload'
import Modal from '../../components/Modal'
import HorariosContagemConfig from '../../components/HorariosContagemConfig'

const TABELAS = ['eventos', 'setores', 'usuarios', 'designacoes', 'localizacoes', 'canais', 'mensagens', 'contagens', 'reunioes', 'reuniao_participantes', 'logs_acesso']
const eventoVazio = { nome: '', tipo: 'congresso', local: '', data_inicio: '', data_fim: '', ativo: true }

export default function Configuracoes() {
  const { evento, setEvento, eventos, carregarEventos } = useEvento()
  const [logo, setLogo] = useState(localStorage.getItem('cfg_logo') || '/logo.svg')
  const [contato, setContato] = useState(localStorage.getItem('cfg_contato') || '5538999999999')
  const [video, setVideo] = useState(localStorage.getItem('cfg_video') || '')
  const [tema, setTema] = useState(localStorage.getItem('tema') || 'light')
  const [modalEvento, setModalEvento] = useState(false)
  const [formEvento, setFormEvento] = useState(eventoVazio)
  const [editandoEvento, setEditandoEvento] = useState(null)
  const [confirmLimpar, setConfirmLimpar] = useState(false)
  const [confirmPessoas, setConfirmPessoas] = useState(false)
  const [senha, setSenha] = useState('')

  useEffect(() => { carregarEventos() }, [])

  function salvarApp() {
    localStorage.setItem('cfg_logo', logo)
    localStorage.setItem('cfg_contato', contato.replace(/\D/g, ''))
    localStorage.setItem('cfg_video', video)
    toast.success('Configurações salvas!')
  }

  function aplicarTema(t) {
    setTema(t); localStorage.setItem('tema', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  // ---- Eventos ----
  function novoEvento() { setEditandoEvento(null); setFormEvento(eventoVazio); setModalEvento(true) }
  function editarEvento(ev) {
    setEditandoEvento(ev)
    setFormEvento({ nome: ev.nome, tipo: ev.tipo, local: ev.local || '', data_inicio: ev.data_inicio || '', data_fim: ev.data_fim || '', ativo: ev.ativo })
    setModalEvento(true)
  }
  async function salvarEvento(e) {
    e.preventDefault()
    if (!formEvento.nome.trim()) return toast.error('Informe o nome.')
    const dados = { ...formEvento, data_inicio: formEvento.data_inicio || null, data_fim: formEvento.data_fim || null }
    const { error } = editandoEvento
      ? await supabase.from('eventos').update(dados).eq('id', editandoEvento.id)
      : await supabase.from('eventos').insert(dados)
    if (error) return toast.error(error.message)
    toast.success('Evento salvo!'); setModalEvento(false); carregarEventos()
  }
  async function alternarAtivo(ev) {
    await supabase.from('eventos').update({ ativo: !ev.ativo }).eq('id', ev.id)
    carregarEventos()
  }

  // ---- Backup ----
  async function backup() {
    const dump = {}
    for (const t of TABELAS) {
      const { data } = await supabase.from(t).select('*')
      dump[t] = data || []
    }
    baixarJSON(`backup-indicador360-${new Date().toISOString().slice(0, 10)}`, dump)
    toast.success('Backup gerado!')
  }

  // ---- Limpar dados (confirma com senha) ----
  async function limparDados() {
    if (senha !== 'APAGAR') return toast.error('Digite APAGAR para confirmar.')
    // apaga em ordem segura (dependências primeiro)
    for (const t of ['reuniao_participantes', 'mensagens', 'contagens', 'localizacoes', 'designacoes', 'logs_acesso', 'reunioes', 'canais', 'setores']) {
      await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    toast.success('Dados operacionais apagados (usuários e eventos mantidos).')
    setConfirmLimpar(false); setSenha('')
  }

  // ---- Limpezas específicas ----
  async function limparChats() {
    if (!confirm('Apagar TODAS as conversas (mensagens) deste evento? Não pode ser desfeito.')) return
    const { data: cs } = await supabase.from('canais').select('id').eq('evento_id', evento?.id)
    const ids = (cs || []).map((c) => c.id)
    if (ids.length) await supabase.from('mensagens').delete().in('canal_id', ids)
    toast.success('Conversas apagadas.')
  }
  async function limparAlertas() {
    if (!confirm('Limpar os alertas/avisos ativos deste evento?')) return
    await supabase.from('avisos').delete().eq('evento_id', evento?.id)
    toast.success('Alertas limpos.')
  }
  async function apagarProgramacaoEPessoas() {
    if (senha !== 'APAGAR') return toast.error('Digite APAGAR para confirmar.')
    // remove a programação (designações) e os voluntários/capitães (mantém coordenadores/admin)
    await supabase.from('designacoes').delete().eq('evento_id', evento?.id)
    await supabase.from('contagens').delete().eq('evento_id', evento?.id)
    await supabase.from('localizacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('usuarios').delete().in('funcao', ['voluntario', 'capitao'])
    toast.success('Programação e voluntários/capitães apagados (coordenadores/admin mantidos).')
    setConfirmLimpar(false); setSenha('')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Aparência */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Aparência</h2>
        <div>
          <label className="label">Logo do sistema</label>
          <FotoUpload bucket="logos" valor={logo} onPronto={setLogo} redondo={false} label="Trocar logo" />
        </div>
        <div>
          <label className="label">Tema</label>
          <div className="flex gap-2">
            <button onClick={() => aplicarTema('light')} className={tema === 'light' ? 'btn-primary' : 'btn-ghost'}><Sun size={16} /> Claro</button>
            <button onClick={() => aplicarTema('dark')} className={tema === 'dark' ? 'btn-primary' : 'btn-ghost'}><Moon size={16} /> Escuro</button>
          </div>
        </div>
      </div>

      {/* Ajuda / contato */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Tela de Ajuda</h2>
        <div><label className="label">WhatsApp do responsável (com 55)</label><input className="input" value={contato} onChange={(e) => setContato(e.target.value)} placeholder="5538999999999" /></div>
        <div><label className="label">Link do vídeo tutorial (YouTube)</label><input className="input" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/..." /></div>
        <button onClick={salvarApp} className="btn-primary">Salvar configurações</button>
      </div>

      {/* Horários de contagem */}
      <HorariosContagemConfig evento={evento} />

      {/* Eventos */}
      <div className="card space-y-3">
        <div className="flex items-center"><h2 className="font-semibold flex-1">Eventos</h2><button onClick={novoEvento} className="btn-primary"><Plus size={16} /> Novo evento</button></div>
        {eventos.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 border-t dark:border-slate-700 pt-2">
            <div className="flex-1">
              <div className="font-medium">{ev.nome} <span className="text-xs text-gray-400 capitalize">({ev.tipo})</span></div>
              <div className="text-xs text-gray-500">{ev.local}</div>
            </div>
            {evento?.id === ev.id && <span className="text-xs text-primary font-semibold">selecionado</span>}
            <button onClick={() => setEvento(ev)} className="text-sm text-primary">Usar</button>
            <button onClick={() => alternarAtivo(ev)} className={`text-sm ${ev.ativo ? 'text-secundaria' : 'text-gray-400'}`}>{ev.ativo ? 'Ativo' : 'Inativo'}</button>
            <button onClick={() => editarEvento(ev)} className="text-sm text-gray-500">Editar</button>
          </div>
        ))}
        {eventos.length === 0 && <p className="text-gray-400 text-sm">Nenhum evento. Crie o primeiro.</p>}
      </div>

      {/* Dados */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Dados</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={backup} className="btn-secundaria"><Save size={16} /> Backup completo (JSON)</button>
          <button onClick={limparChats} className="btn-ghost"><Trash2 size={16} /> Limpar conversas</button>
          <button onClick={limparAlertas} className="btn-ghost"><Trash2 size={16} /> Limpar alertas ativos</button>
        </div>
        <div className="flex gap-2 flex-wrap pt-1">
          <button onClick={() => setConfirmLimpar(true)} className="btn-urgencia"><Trash2 size={16} /> Limpar dados operacionais</button>
          <button onClick={() => setConfirmPessoas(true)} className="btn-urgencia"><Trash2 size={16} /> Apagar programação + voluntários/capitães</button>
        </div>
        <p className="text-xs text-gray-400">Backup exporta tudo. "Limpar conversas" apaga as mensagens; "Limpar alertas" apaga os avisos. "Dados operacionais" remove mensagens, contagens, designações, localizações, reuniões, canais e setores (mantém usuários). "Apagar programação + voluntários/capitães" remove as designações e os usuários voluntário/capitão (mantém coordenadores/admin). Tudo é irreversível.</p>
      </div>

      {/* Modal evento */}
      <Modal aberto={modalEvento} titulo={editandoEvento ? 'Editar evento' : 'Novo evento'} onFechar={() => setModalEvento(false)}>
        <form onSubmit={salvarEvento} className="space-y-3">
          <div><label className="label">Nome</label><input className="input" value={formEvento.nome} onChange={(e) => setFormEvento({ ...formEvento, nome: e.target.value })} /></div>
          <div><label className="label">Tipo</label>
            <select className="input" value={formEvento.tipo} onChange={(e) => setFormEvento({ ...formEvento, tipo: e.target.value })}>
              <option value="congresso">Congresso</option><option value="assembleia">Assembleia</option>
            </select>
          </div>
          <div><label className="label">Local</label><input className="input" value={formEvento.local} onChange={(e) => setFormEvento({ ...formEvento, local: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Início</label><input type="date" className="input" value={formEvento.data_inicio} onChange={(e) => setFormEvento({ ...formEvento, data_inicio: e.target.value })} /></div>
            <div><label className="label">Fim</label><input type="date" className="input" value={formEvento.data_fim} onChange={(e) => setFormEvento({ ...formEvento, data_fim: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formEvento.ativo} onChange={(e) => setFormEvento({ ...formEvento, ativo: e.target.checked })} /> Ativo</label>
          <button className="btn-primary w-full">{editandoEvento ? 'Salvar' : 'Criar'}</button>
        </form>
      </Modal>

      {/* Modal limpar */}
      <Modal aberto={confirmLimpar} titulo="⚠️ Confirmar limpeza" onFechar={() => setConfirmLimpar(false)}>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">Esta ação é irreversível. Digite <b>APAGAR</b> para confirmar.</p>
        <input className="input mb-3" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="APAGAR" />
        <div className="flex gap-2">
          <button onClick={() => setConfirmLimpar(false)} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={limparDados} className="btn-urgencia flex-1">Apagar dados</button>
        </div>
      </Modal>

      {/* Modal apagar programação + voluntários/capitães */}
      <Modal aberto={confirmPessoas} titulo="⚠️ Apagar programação + pessoas" onFechar={() => setConfirmPessoas(false)}>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">
          Isto apaga <b>todas as designações (programação)</b> e <b>todos os voluntários e capitães</b>
          (coordenadores e admin são mantidos). Irreversível. Digite <b>APAGAR</b> para confirmar.
        </p>
        <input className="input mb-3" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="APAGAR" />
        <div className="flex gap-2">
          <button onClick={() => setConfirmPessoas(false)} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={apagarProgramacaoEPessoas} className="btn-urgencia flex-1">Apagar tudo</button>
        </div>
      </Modal>
    </div>
  )
}
