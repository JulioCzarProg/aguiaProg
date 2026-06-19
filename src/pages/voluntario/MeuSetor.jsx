import { useEffect, useState } from 'react'
import { MapPin, Minus, Plus, Send, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'
import { useContagem, periodoDoTurno } from '../../hooks/useContagem'
import { useLocalizacao } from '../../hooks/useLocalizacao'
import { corDe } from '../../components/cores'
import ValidarContagens from '../../components/ValidarContagens'
import HorariosResumo from '../../components/HorariosResumo'

export default function MeuSetor() {
  const { usuario, temNivel } = useAuth()
  const { evento } = useEvento()
  const [designacoes, setDesignacoes] = useState([])
  const [idx, setIdx] = useState(0)
  const [capitao, setCapitao] = useState(null)
  const [carregando, setCarregando] = useState(true)

  // separa designações de SETOR (voluntário) das de ÁREA (capitão)
  const setoresDesig = designacoes.filter((d) => (d.setores?.tipo || 'setor') !== 'area')
  const minhasAreas = [...new Map(designacoes.filter((d) => d.setores?.tipo === 'area')
    .map((d) => [d.setores.nome, { nome: d.setores.nome, turno: d.turno }])).values()]
  const desSel = setoresDesig[idx]
  const setorAtual = desSel?.setores
  const turno = desSel?.turno || ''
  const periodo = periodoDoTurno(turno)
  const { quantidade, incrementar, enviar, enviando, setQuantidade } = useContagem(setorAtual?.id)
  const { enviarAgora, status } = useLocalizacao()

  useEffect(() => {
    if (!usuario || !evento) return
    setCarregando(true)
    supabase.from('designacoes')
      .select('id, turno, data_designacao, setores(*)')
      .eq('usuario_id', usuario.id)
      .eq('evento_id', evento.id)
      .then(({ data }) => { setDesignacoes(data || []); setCarregando(false) })
  }, [usuario, evento])

  // capitão do setor selecionado
  useEffect(() => {
    if (!setorAtual?.id) { setCapitao(null); return }
    supabase.from('designacoes')
      .select('usuarios!inner(nome, telefone, funcao)')
      .eq('setor_id', setorAtual.id).eq('usuarios.funcao', 'capitao').limit(1)
      .then(({ data }) => setCapitao(data?.[0]?.usuarios || null))
  }, [setorAtual?.id])

  async function estouAqui() {
    try { await enviarAgora(); toast.success('Localização atualizada!') }
    catch { toast.error('Não foi possível pegar o GPS. Use o Mapa para marcar manualmente.') }
  }

  async function enviarContagem() {
    if (!setorAtual) return toast.error('Você não tem setor designado.')
    if (!confirm(`Enviar contagem de ${quantidade} pessoas — ${turno}?`)) return
    try {
      await enviar(turno)
      toast.success('Contagem enviada para o capitão validar!')
      setQuantidade(0)
    } catch { toast.error('Erro ao enviar contagem.') }
  }

  async function urgencia() {
    if (!confirm('Enviar ALERTA DE URGÊNCIA para o canal Geral?')) return
    const { data: canal } = await supabase.from('canais')
      .select('id').eq('evento_id', evento.id).eq('nome', 'Geral').maybeSingle()
    if (!canal) return toast.error('Canal Geral não encontrado.')
    await supabase.from('mensagens').insert({
      canal_id: canal.id, usuario_id: usuario.id, nome_autor: usuario.nome, funcao_autor: usuario.funcao,
      texto: `🚨 URGÊNCIA no setor ${setorAtual?.codigo || '—'}! Preciso de ajuda.`, tipo: 'texto', urgente: true
    })
    toast.success('Alerta enviado!'); navigator.vibrate?.([200, 100, 200])
  }

  if (carregando) return <div className="p-6 text-gray-400">Carregando…</div>

  // Capitão: vê suas ÁREAS (não um setor) + validação/lançamento de contagem
  if (!setorAtual) {
    if (minhasAreas.length || temNivel('capitao')) {
      return (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <div className="rounded-2xl overflow-hidden shadow">
            <div className="p-5 text-white bg-secundaria">
              <div className="text-sm opacity-90">Capitão de área</div>
              <div className="text-2xl font-extrabold">{usuario.nome}</div>
              {minhasAreas.length > 0 && (
                <p className="text-sm opacity-95 mt-1">Áreas: {minhasAreas.map((a) => `${a.nome} (${a.turno})`).join(' • ')}</p>
              )}
            </div>
          </div>
          <HorariosResumo evento={evento} turnos={temNivel('coordenador') ? undefined : [...new Set(designacoes.map((d) => d.turno).filter(Boolean))]} />
          <ValidarContagens evento={evento} usuario={usuario} />
        </div>
      )
    }
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="card text-center text-gray-500">
          <p className="text-lg">Você não tem setor designado neste evento.</p>
          <p className="text-sm mt-2">Procure seu coordenador.</p>
        </div>
      </div>
    )
  }

  const c = corDe(setorAtual.cor)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Seletor de designação (dia/turno) quando há mais de uma */}
      {setoresDesig.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {setoresDesig.map((d, i) => (
            <button key={d.id} onClick={() => { setIdx(i); setQuantidade(0) }}
              className={`px-3 py-2 rounded-full text-sm whitespace-nowrap ${i === idx ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border dark:border-slate-700'}`}>
              {d.setores?.codigo} • {d.turno}
            </button>
          ))}
        </div>
      )}

      {/* Card do setor */}
      <div className="rounded-2xl overflow-hidden shadow">
        <div className="p-5 text-white" style={{ background: c.bg }}>
          <div className="text-sm opacity-90">Seu setor</div>
          <div className="text-4xl font-extrabold">{setorAtual.codigo}</div>
          <div className="text-xl font-semibold">{setorAtual.nome}</div>
          {setorAtual.descricao && <p className="text-sm opacity-90 mt-1">{setorAtual.descricao}</p>}
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 grid grid-cols-2 gap-3 text-sm">
          <Info rotulo="Turno" valor={turno || '—'} />
          <Info rotulo="Período" valor={periodo === 'manha' ? 'Manhã' : 'Tarde'} />
          <Info rotulo="Capitão" valor={capitao?.nome || '—'} />
          <div>
            <div className="text-gray-400">Contato</div>
            {capitao?.telefone
              ? <a className="text-primary font-semibold" href={`https://wa.me/55${capitao.telefone}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
              : <div className="font-semibold">—</div>}
          </div>
        </div>
      </div>

      {/* Horário de contagem (turnos do usuário; coordenador+ vê todos) */}
      <HorariosResumo evento={evento}
        turnos={temNivel('coordenador') ? undefined : [...new Set(designacoes.map((d) => d.turno).filter(Boolean))]} />

      {/* Validação (capitães e acima) */}
      {temNivel('capitao') && <ValidarContagens evento={evento} usuario={usuario} />}

      {/* Localização */}
      <button onClick={estouAqui} className="btn-secundaria btn-lg w-full">
        <MapPin size={20} /> {status === 'enviando' ? 'Localizando…' : 'Estou aqui'}
      </button>

      {/* Contagem */}
      <div className="card">
        <div className="text-center font-semibold mb-1">Contagem de assistência</div>
        <div className="text-center text-xs text-gray-400 mb-3">{turno}</div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => incrementar(-1)} aria-label="Menos"
            className="btn w-14 h-14 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0"><Minus size={28} /></button>
          <input type="number" inputMode="numeric" min="0" value={quantidade}
            onChange={(e) => setQuantidade(Math.max(0, parseInt(e.target.value || '0', 10)))}
            className="input !min-h-[64px] text-4xl font-extrabold text-center w-32 tabular-nums" />
          <button onClick={() => incrementar(1)} aria-label="Mais"
            className="btn w-14 h-14 rounded-full bg-primary text-white shrink-0"><Plus size={28} /></button>
        </div>
        <button onClick={enviarContagem} disabled={enviando} className="btn-primary btn-lg w-full mt-4">
          <Send size={18} /> {enviando ? 'Enviando…' : 'Enviar contagem'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">Digite ou use +/−. Sua contagem vai para o capitão validar.</p>
      </div>

      {/* Urgência */}
      <button onClick={urgencia} className="btn-urgencia btn-lg w-full text-xl !min-h-[64px]">
        <TriangleAlert size={24} /> URGÊNCIA
      </button>
    </div>
  )
}

function Info({ rotulo, valor }) {
  return (
    <div>
      <div className="text-gray-400">{rotulo}</div>
      <div className="font-semibold">{valor}</div>
    </div>
  )
}
