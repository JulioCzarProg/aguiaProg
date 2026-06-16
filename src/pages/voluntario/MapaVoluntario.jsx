import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useEvento } from '../../contexts/EventoContext'
import { useLocalizacao } from '../../hooks/useLocalizacao'
import { useRealtime } from '../../hooks/useRealtime'
import MapaEvento from '../../components/MapaEvento'
import { corDe } from '../../components/cores'

export default function MapaVoluntario() {
  const { usuario, temNivel } = useAuth()
  const { evento } = useEvento()
  const [setores, setSetores] = useState([])
  const [designacoes, setDesignacoes] = useState([])
  const [locs, setLocs] = useState([])
  const [camada, setCamada] = useState(1)
  const { marcarManual } = useLocalizacao()

  useEffect(() => {
    if (!evento) return
    supabase.from('setores').select('*').eq('evento_id', evento.id)
      .then(({ data }) => setSetores(data || []))
    supabase.from('designacoes').select('usuario_id, setor_id').eq('evento_id', evento.id)
      .then(({ data }) => setDesignacoes(data || []))
    supabase.from('localizacoes').select('usuario_id, setor_id, updated_at')
      .then(({ data }) => setLocs(data || []))
  }, [evento])

  // PERMISSÕES de localização:
  // voluntário = não vê ninguém; capitão = só a equipe; coordenador+ = todos.
  const locsVisiveis = useMemo(() => {
    if (temNivel('coordenador')) return locs
    if (usuario.funcao === 'capitao') {
      const grupoDe = Object.fromEntries(setores.map((s) => [s.id, s.descricao]))
      const meusGrupos = new Set(designacoes.filter((d) => d.usuario_id === usuario.id).map((d) => grupoDe[d.setor_id]).filter(Boolean))
      const setoresTime = new Set(setores.filter((s) => meusGrupos.has(s.descricao)).map((s) => s.id))
      const time = new Set(designacoes.filter((d) => setoresTime.has(d.setor_id)).map((d) => d.usuario_id))
      return locs.filter((l) => time.has(l.usuario_id))
    }
    return [] // voluntário só vê o mapa, sem localização de outros
  }, [locs, designacoes, setores, usuario, temNivel])

  // Atualiza pontos em tempo real
  useRealtime('localizacoes', {
    onInsert: (n) => setLocs((p) => [...p.filter((l) => l.usuario_id !== n.usuario_id), n]),
    onUpdate: (n) => setLocs((p) => [...p.filter((l) => l.usuario_id !== n.usuario_id), n])
  })

  async function marcar(setor) {
    await marcarManual(setor.id)
    toast.success(`Você marcou presença no setor ${setor.codigo}`)
  }

  return (
    <div className="p-4 space-y-3 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lg">Mapa do ginásio</h2>
        {evento?.tipo === 'congresso' && (
          <div className="flex rounded-lg overflow-hidden border dark:border-slate-700 text-sm">
            <button onClick={() => setCamada(1)} className={`px-3 py-1.5 ${camada === 1 ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800'}`}>Principal</button>
            <button onClick={() => setCamada(2)} className={`px-3 py-1.5 ${camada === 2 ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800'}`}>Internos</button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500">
        Toque no seu setor para marcar presença (ginásio fechado).
        {!temNivel('capitao') && ' A localização dos colegas não é exibida.'}
        {usuario.funcao === 'capitao' && ' Você vê a localização da sua equipe.'}
      </p>

      <div className="aspect-square">
        <MapaEvento evento={evento} setores={setores} locs={locsVisiveis} camada={camada} planta onSetorClick={marcar} />
      </div>

      {/* Legenda */}
      <div className="card">
        <div className="font-semibold mb-2 text-sm">Legenda</div>
        <div className="flex flex-wrap gap-2">
          {setores.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-sm">
              <span className="w-4 h-4 rounded" style={{ background: corDe(s.cor).bg }} />
              <span><b>{s.codigo}</b> {s.nome}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> presente</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400" /> +5 min sem atualizar</span>
        </div>
      </div>
    </div>
  )
}
