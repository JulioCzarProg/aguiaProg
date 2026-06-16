import { corDe } from './cores'

// ===================================================================
// Mapa do ginásio (congresso) — arquibancada em segmentos (cunhas) com
// contorno colorido e divisas, palco à esquerda, quadra central (6 blocos)
// e arquibancadas hachuradas. Localização ao vivo dentro de cada setor.
// ===================================================================
const VB = { w: 1040, h: 1000 }
const CX = 512, CY = 500, R = 488
const TAU = Math.PI / 180
const pol = (r, deg) => [CX + r * Math.cos(deg * TAU), CY + r * Math.sin(deg * TAU)]

// caminho de uma cunha (segmento anelar) entre dois raios e dois ângulos
function cunha(rIn, rOut, a1, a2, steps = 14) {
  const pts = []
  for (let i = 0; i <= steps; i++) pts.push(pol(rOut, a1 + (a2 - a1) * (i / steps)))
  for (let i = steps; i >= 0; i--) pts.push(pol(rIn, a1 + (a2 - a1) * (i / steps)))
  return 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z'
}

// Bandas de raio
const R_OUT = R, R_MO = 352, R_MI = 338, R_IN = 232
// Arco da arquibancada colorida (topo → direita → baixo)
const A1A = 272, A2A = 88 + 360 // 448 (varre horário cruzando o leste)
const COLS = 10
const PASSO = (A2A - A1A) / COLS // 17.6°
const GAP = 1.6

// Colunas: cada uma tem um setor externo e um interno (como na planta)
const EXT = ['C2', 'C4', 'C6', 'C8', 'C10', 'D1', 'D3', 'D5', 'D7', 'D9']
const INT = ['C3', 'C5', 'C7', 'C9', null, 'D2', 'D4', 'D6', 'D8', 'D10']

const GEO = {}
for (let i = 0; i < COLS; i++) {
  const a1 = A1A + i * PASSO + GAP
  const a2 = A1A + (i + 1) * PASSO - GAP
  const mid = (a1 + a2) / 2
  if (EXT[i]) { const [bx, by] = pol((R_MO + R_OUT) / 2, mid); GEO[EXT[i]] = { tipo: 'cunha', d: cunha(R_MO, R_OUT, a1, a2), bx, by } }
  if (INT[i]) { const [bx, by] = pol((R_IN + R_MI) / 2, mid); GEO[INT[i]] = { tipo: 'cunha', d: cunha(R_IN, R_MI, a1, a2), bx, by } }
}
// C1 — faixa azul no topo-esquerdo, entre a arquibancada direita e o início do arco
{ const a1 = 263 + GAP, a2 = 271 - GAP, mid = 267, [bx, by] = pol((R_MO + R_OUT) / 2, mid)
  GEO.C1 = { tipo: 'cunha', d: cunha(R_MO, R_OUT, a1, a2), bx, by } }
// Mini-setores: portões (A), quadra (B) e anel esquerdo (D11)
const mini = (x, y) => ({ tipo: 'mini', bx: x, by: y })
Object.assign(GEO, {
  A4: mini(150, 500), A1: mini(268, 500), A2: mini(238, 612), A3: mini(238, 388), A5: mini(316, 322),
  B2: mini(512, 432), B1: mini(450, 500), B4: mini(388, 500), B3: mini(512, 568),
  D11: mini(300, 712)
})

// Cunhas hachuradas das arquibancadas grandes (esquerda)
const STAND_DIR = cunha(R_IN, R_OUT, 200, 262)   // ARQUIBANCADA DIREITA (sup. esq.)
const STAND_ESQ = cunha(R_IN, R_OUT, 98, 160)    // ARQUIBANCADA ESQUERDA (inf. esq.)
const [dirX, dirY] = pol((R_IN + R_OUT) / 2, 231)
const [esqX, esqY] = pol((R_IN + R_OUT) / 2, 129)

export default function MapaCongresso({ setores = [], presencas = [], onSetorClick, setorSelecionado }) {
  const porSetor = {}
  presencas.forEach((p) => { (porSetor[p.codigo] ||= []).push(p) })

  // 6 blocos de cadeiras (2 colunas × 3 linhas), bem distribuídos na quadra
  const blocos = []
  const colX = [352, 470], rowY = [372, 478, 584]
  colX.forEach((bx) => rowY.forEach((by) => blocos.push([bx, by])))

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 select-none">
      <defs>
        <pattern id="hach" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#eef2f7" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="#cbd5e1" strokeWidth="2.2" />
        </pattern>
      </defs>

      {/* parede externa e trilho da quadra */}
      <circle cx={CX} cy={CY} r={R + 4} fill="none" stroke="#94a3b8" strokeWidth="2" />
      <circle cx={CX} cy={CY} r={R_IN - 4} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* arquibancadas grandes hachuradas */}
      <path d={STAND_DIR} fill="url(#hach)" stroke="#64748b" strokeWidth="2.5" />
      <path d={STAND_ESQ} fill="url(#hach)" stroke="#64748b" strokeWidth="2.5" />
      <text x={dirX} y={dirY - 8} fontSize="19" fontWeight="800" fill="#475569" textAnchor="middle">ARQUIBANCADA</text>
      <text x={dirX} y={dirY + 14} fontSize="19" fontWeight="800" fill="#475569" textAnchor="middle">DIREITA</text>
      <text x={esqX} y={esqY - 8} fontSize="19" fontWeight="800" fill="#475569" textAnchor="middle">ARQUIBANCADA</text>
      <text x={esqX} y={esqY + 14} fontSize="19" fontWeight="800" fill="#475569" textAnchor="middle">ESQUERDA</text>

      {/* palco à esquerda + posições técnicas */}
      <rect x={70} y={CY - 95} width="56" height="190" rx="6" fill="#1e293b" />
      <text x={98} y={CY} fontSize="22" fill="#fff" textAnchor="middle" fontWeight="700" transform={`rotate(-90 98 ${CY})`}>PALCO</text>
      <circle cx={170} cy={CY - 70} r="13" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <circle cx={170} cy={CY + 70} r="13" fill="none" stroke="#94a3b8" strokeWidth="2" />

      {/* quadra central: 6 blocos de cadeiras */}
      <text x={450} y={350} fontSize="16" fontWeight="700" fill="#94a3b8" textAnchor="middle">QUADRA</text>
      {blocos.map(([bx, by], i) => (
        <g key={i}>
          <rect x={bx} y={by} width="108" height="96" rx="5" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="1.5" />
          {[0, 1, 2, 3].map((l) => (
            <line key={l} x1={bx + 6} y1={by + 18 + l * 20} x2={bx + 102} y2={by + 18 + l * 20} stroke="#dbe2ea" strokeWidth="3" />
          ))}
          <text x={bx + 54} y={by + 14} fontSize="12" fill="#94a3b8" textAnchor="middle">144</text>
        </g>
      ))}

      {/* setores */}
      {setores.map((s) => {
        const g = GEO[s.codigo]; if (!g) return null
        const c = corDe(s.cor)
        const sel = s.id === setorSelecionado
        const presentes = porSetor[s.codigo] || []
        const rBadge = g.tipo === 'mini' ? 17 : 22

        return (
          <g key={s.id} onClick={() => onSetorClick?.(s)} style={{ cursor: onSetorClick ? 'pointer' : 'default' }}>
            {g.tipo === 'cunha' && (
              <path d={g.d} fill={c.bg} fillOpacity={sel ? 0.32 : 0.16}
                stroke={c.bg} strokeWidth={sel ? 6 : 3.5} strokeLinejoin="round" />
            )}
            {/* badge com o código */}
            <circle cx={g.bx} cy={g.by} r={rBadge} fill={c.bg}
              stroke={sel ? '#0f172a' : '#fff'} strokeWidth={sel ? 3.5 : 2} />
            <text x={g.bx} y={g.by + (rBadge > 18 ? 7 : 5)} fontSize={g.tipo === 'mini' ? 13 : 17}
              fontWeight="800" fill="#fff" textAnchor="middle">{s.codigo}</text>

            {/* presença ao vivo */}
            {presentes.slice(0, 8).map((pr, i) => {
              const ang = (i / 8) * Math.PI * 2
              return (
                <circle key={pr.id} cx={g.bx + Math.cos(ang) * (rBadge + 8)} cy={g.by + Math.sin(ang) * (rBadge + 8)} r="5.5"
                  fill={pr.atrasado ? '#9ca3af' : '#22c55e'} stroke="#fff" strokeWidth="1.5">
                  {!pr.atrasado && <animate attributeName="r" values="5.5;7.5;5.5" dur="2s" repeatCount="indefinite" />}
                </circle>
              )
            })}
            {presentes.length > 8 && (
              <text x={g.bx} y={g.by - rBadge - 7} fontSize="14" fill="#16a34a" textAnchor="middle" fontWeight="800">+{presentes.length}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
