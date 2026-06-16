import { useState } from 'react'
import { MessageCircle, Phone, X, MapPin } from 'lucide-react'

// Posições dos códigos no SVG real (viewBox 1080x1011) — extraídas do arquivo.
export const POS = {
  C1: [305.4, 286.3], C2: [532.0, 137.8], C3: [577.2, 225.8], C4: [698.7, 126.7], C5: [655.9, 253.5],
  C6: [872.9, 205.4], C7: [774.0, 298.8], C8: [952.1, 365.3], C9: [826.4, 398.6],
  D1: [975.2, 513.3], D2: [845.7, 512.8], D3: [951.7, 661.9], D4: [825.5, 623.4], D5: [868.3, 821.1],
  D6: [766.1, 732.3], D7: [688.2, 909.3], D8: [645.4, 784.9], D9: [549.8, 943.2], D10: [534.6, 807.5]
}
// Bases por camada (camada 1 = arquibancadas; camada 2 = planta interna)
const BASES = {
  1: { svg: '/mapa-arquibancadas.svg', w: 1080, h: 1011 },
  2: { svg: '/planta-interna.svg', w: 1075, h: 1122.6667 }
}

// Mapa baseado no SVG real + pontos de presença ao vivo.
// presencas: [{ id, codigo, atrasado, nome?, telefone?, setorNome?, capitao?, contagem? }]
export default function MapaArquibancadas({ setores = [], presencas = [], camada = 1, onSetorClick, onUserClick }) {
  const [popup, setPopup] = useState(null) // { x, y, user }
  const base = BASES[camada] || BASES[1]
  const VB = { w: base.w, h: base.h }
  const temPos = camada === 1 // posições (POS) são dos setores C/D (camada 1)

  const porSetor = {}
  if (temPos) presencas.forEach((p) => { if (POS[p.codigo]) (porSetor[p.codigo] ||= []).push(p) })

  function clicarUsuario(e, user, contRect) {
    if (!onUserClick && !user.telefone) return
    const r = contRect.getBoundingClientRect()
    setPopup({ x: e.clientX - r.left, y: e.clientY - r.top, user })
  }

  return (
    <div className="relative w-full h-full" id="mapa-arq-wrap">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-full select-none">
        <image href={base.svg} x="0" y="0" width={VB.w} height={VB.h} />

        {/* áreas clicáveis por setor (marcar presença) */}
        {temPos && onSetorClick && setores.map((s) => {
          const p = POS[s.codigo]; if (!p) return null
          return <circle key={s.id} cx={p[0]} cy={p[1]} r="26" fill="transparent"
            style={{ cursor: 'pointer' }} onClick={() => onSetorClick(s)} />
        })}

        {/* pontos de presença ao vivo */}
        {Object.entries(porSetor).map(([cod, lista]) => {
          const [bx, by] = POS[cod]
          return lista.slice(0, 10).map((u, i) => {
            const ang = (i / Math.max(1, Math.min(10, lista.length))) * Math.PI * 2
            const x = bx + Math.cos(ang) * 22, y = by + Math.sin(ang) * 22
            return (
              <circle key={u.id} cx={x} cy={y} r="8"
                fill={u.atrasado ? '#9ca3af' : '#22c55e'} stroke="#fff" strokeWidth="2"
                style={{ cursor: onUserClick ? 'pointer' : 'default' }}
                onClick={(e) => onUserClick && clicarUsuario(e, u, document.getElementById('mapa-arq-wrap'))}>
                {!u.atrasado && <animate attributeName="r" values="8;11;8" dur="2s" repeatCount="indefinite" />}
              </circle>
            )
          })
        })}
      </svg>

      {/* Popup do usuário */}
      {popup && (
        <div className="absolute z-30 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 overflow-hidden"
          style={{ top: Math.min(popup.y, 600), left: Math.min(popup.x, 760) }} onClick={(e) => e.stopPropagation()}>
          <div className="bg-primary text-white px-3 py-2 flex items-center gap-2">
            <span className="font-bold flex-1 truncate">{popup.user.nome || 'Voluntário'}</span>
            <button onClick={() => setPopup(null)} aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="p-3 text-sm space-y-1">
            <div className="flex items-center gap-1 text-gray-600 dark:text-slate-300"><MapPin size={14} /> Setor <b>{popup.user.codigo}</b>{popup.user.setorNome ? ` — ${popup.user.setorNome}` : ''}</div>
            {popup.user.capitao && <div className="text-gray-500">Capitão: {popup.user.capitao}</div>}
            <div className="text-gray-500">Contagem enviada: <b>{popup.user.contagem ?? '—'}</b></div>
            {popup.user.atrasado && <div className="text-xs text-amber-600">Localização há +5 min</div>}
          </div>
          <div className="flex border-t dark:border-slate-700">
            <a href={popup.user.telefone ? `https://wa.me/55${popup.user.telefone}` : undefined} target="_blank" rel="noreferrer"
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium ${popup.user.telefone ? 'text-secundaria hover:bg-gray-50 dark:hover:bg-slate-700' : 'text-gray-300 pointer-events-none'}`}>
              <MessageCircle size={16} /> Mensagem
            </a>
            <a href={popup.user.telefone ? `tel:+55${popup.user.telefone}` : undefined}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium border-l dark:border-slate-700 ${popup.user.telefone ? 'text-primary hover:bg-gray-50 dark:hover:bg-slate-700' : 'text-gray-300 pointer-events-none'}`}>
              <Phone size={16} /> Ligar
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
