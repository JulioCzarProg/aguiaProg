import { corDe } from './cores'

/**
 * SVG do ginásio com setores coloridos e clicáveis + pontos de colegas.
 * props:
 *  - setores: [{id, codigo, nome, cor, pos_x, pos_y, largura, altura}]
 *  - pontos:  [{id, nome, x, y, setor_id, atrasado}]  (posições 0..100)
 *  - onSetorClick(setor)
 *  - onMapaClick(x,y) (para marcação manual)
 *  - setorSelecionado (id)
 *  - editavel + onMover(id, x, y) para arrastar setores
 */
export default function MapaGinasio({
  setores = [], pontos = [], onSetorClick, onMapaClick,
  setorSelecionado, editavel = false, onMover
}) {
  // Coordenadas em % do viewBox 0..100
  function posClick(e) {
    const svg = e.currentTarget
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }

  function arrastar(e, setor) {
    if (!editavel) return
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    const mover = (ev) => {
      const r = svg.getBoundingClientRect()
      const x = ((ev.clientX - r.left) / r.width) * 100
      const y = ((ev.clientY - r.top) / r.height) * 100
      onMover?.(setor.id, Math.max(0, Math.min(95, x)), Math.max(0, Math.min(92, y)))
    }
    const soltar = () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 select-none"
      onClick={(e) => onMapaClick?.(posClick(e))}
      style={{ cursor: onMapaClick ? 'crosshair' : 'default' }}>
      {/* contorno do ginásio */}
      <rect x="1" y="1" width="98" height="98" rx="2" fill="none" stroke="#cbd5e1" strokeWidth="0.4" />
      {/* palco */}
      <rect x="35" y="2" width="30" height="7" rx="1" fill="#94a3b8" />
      <text x="50" y="6.6" textAnchor="middle" fontSize="3" fill="#fff">PALCO</text>

      {setores.map((s) => {
        const c = corDe(s.cor)
        const w = s.largura || 18, h = s.altura || 12
        const x = s.pos_x ?? 10, y = s.pos_y ?? 15
        const sel = s.id === setorSelecionado
        return (
          <g key={s.id}
            onClick={(e) => { e.stopPropagation(); onSetorClick?.(s) }}
            onMouseDown={(e) => arrastar(e, s)}
            style={{ cursor: editavel ? 'grab' : (onSetorClick ? 'pointer' : 'default') }}>
            <rect x={x} y={y} width={w} height={h} rx="1.5"
              fill={c.bg} opacity={sel ? 1 : 0.85}
              stroke={sel ? '#0f172a' : '#fff'} strokeWidth={sel ? 0.8 : 0.4} />
            <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle"
              fontSize="3.2" fontWeight="700" fill="#fff">{s.codigo}</text>
          </g>
        )
      })}

      {/* pontos de colegas */}
      {pontos.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="1.6"
            fill={p.atrasado ? '#9ca3af' : '#22c55e'}
            stroke="#fff" strokeWidth="0.4">
            {!p.atrasado && (
              <animate attributeName="r" values="1.6;2.2;1.6" dur="2s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      ))}
    </svg>
  )
}
