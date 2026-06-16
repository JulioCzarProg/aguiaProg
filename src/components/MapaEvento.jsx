import MapaEditor from './MapaEditor'
import MapaGinasio from './MapaGinasio'

const ATRASO = 5 * 60 * 1000 // 5 min

// Congresso: mesmo componente para visualizar e editar (MapaEditor) — assim os
// elementos inseridos/editados aparecem nos dois. Assembleia = MapaGinasio.
export default function MapaEvento({ evento, setores = [], locs = [], ...rest }) {
  const ehCongresso = evento?.tipo === 'congresso'

  if (ehCongresso) {
    const presencas = rest.presencas || locs.filter((l) => l.setor_id).map((l) => {
      const s = setores.find((x) => x.id === l.setor_id); if (!s) return null
      return { id: l.usuario_id, codigo: s.codigo, atrasado: (Date.now() - new Date(l.updated_at).getTime()) > ATRASO }
    }).filter(Boolean)
    return <MapaEditor setores={setores} presencas={presencas} eventoId={evento.id}
      editavel={rest.editavel} camada={rest.camada ?? 1} recarregar={rest.recarregar}
      onSetorClick={rest.onSetorClick} onUserClick={rest.onUserClick} setorSelecionado={rest.setorSelecionado} />
  }

  // Assembleia / genérico
  const pontos = locs.filter((l) => l.setor_id).map((l, i) => {
    const s = setores.find((x) => x.id === l.setor_id)
    if (!s) return null
    return {
      id: l.usuario_id,
      x: (s.pos_x ?? 10) + (s.largura ?? 18) / 2 + (i % 3 - 1) * 2,
      y: (s.pos_y ?? 15) + (s.altura ?? 12) / 2 + (Math.floor(i / 3) % 3 - 1) * 2,
      atrasado: (Date.now() - new Date(l.updated_at).getTime()) > ATRASO
    }
  }).filter(Boolean)
  return <MapaGinasio setores={setores} pontos={pontos} {...rest} />
}
