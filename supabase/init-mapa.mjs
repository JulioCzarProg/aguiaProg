// Inicializa a geometria editável dos setores do congresso no espaço 0..1000.
// Uso: VITE_SUPABASE_ANON_KEY=... node supabase/init-mapa.mjs
import { createClient } from '@supabase/supabase-js'

const URL = 'https://hldpkgbrbciquxmtlrot.supabase.co'
const ANON = process.env.VITE_SUPABASE_ANON_KEY
if (!ANON) { console.error('Defina VITE_SUPABASE_ANON_KEY'); process.exit(1) }
const sb = createClient(URL, ANON, { auth: { persistSession: false } })

const CX = 500, CY = 500, R = 470, TAU = Math.PI / 180
const pol = (r, d) => [CX + r * Math.cos(d * TAU), CY + r * Math.sin(d * TAU)]
const R_OUT = R, R_MO = 345, R_MI = 330, R_IN = 225
const A1A = 272, A2A = 448, COLS = 10, PASSO = (A2A - A1A) / COLS, GAP = 1.6
const EXT = ['C2', 'C4', 'C6', 'C8', 'C10', 'D1', 'D3', 'D5', 'D7', 'D9']
const INT = ['C3', 'C5', 'C7', 'C9', null, 'D2', 'D4', 'D6', 'D8', 'D10']
const CAMADA2 = new Set(['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'C10', 'D11'])

const geo = {}
for (let i = 0; i < COLS; i++) {
  const a1 = A1A + i * PASSO + GAP, a2 = A1A + (i + 1) * PASSO - GAP, mid = (a1 + a2) / 2
  const arc = (a2 - a1) * TAU
  if (EXT[i]) { const rmid = (R_MO + R_OUT) / 2; const [bx, by] = pol(rmid, mid); geo[EXT[i]] = { cx: bx, cy: by, w: rmid * arc, h: R_OUT - R_MO, rot: mid + 90 } }
  if (INT[i]) { const rmid = (R_IN + R_MI) / 2; const [bx, by] = pol(rmid, mid); geo[INT[i]] = { cx: bx, cy: by, w: rmid * arc, h: R_MI - R_IN, rot: mid + 90 } }
}
{ const a1 = 263, a2 = 271, mid = 267, rmid = (R_MO + R_OUT) / 2, [bx, by] = pol(rmid, mid); geo.C1 = { cx: bx, cy: by, w: rmid * ((a2 - a1) * TAU), h: R_OUT - R_MO, rot: mid + 90 } }
const mini = (x, y, w = 70, h = 52) => ({ cx: x, cy: y, w, h, rot: 0 })
Object.assign(geo, {
  A4: mini(150, 500), A1: mini(255, 500), A2: mini(230, 612), A3: mini(230, 388), A5: mini(312, 330),
  B2: mini(500, 432, 96, 60), B1: mini(450, 500, 96, 60), B4: mini(380, 500, 96, 60), B3: mini(500, 568, 96, 60),
  D11: mini(300, 702)
})

const { data: ev } = await sb.from('eventos').select('id').eq('tipo', 'congresso').order('created_at').limit(1).maybeSingle()
const { data: setores } = await sb.from('setores').select('id, codigo').eq('evento_id', ev.id)
let n = 0
for (const s of setores) {
  const g = geo[s.codigo]; if (!g) continue
  await sb.from('setores').update({
    pos_x: +(g.cx - g.w / 2).toFixed(1), pos_y: +(g.cy - g.h / 2).toFixed(1),
    largura: +g.w.toFixed(1), altura: +g.h.toFixed(1), rotacao: +g.rot.toFixed(1),
    camada: CAMADA2.has(s.codigo) ? 2 : 1
  }).eq('id', s.id)
  n++
}
console.log('Geometria aplicada em', n, 'setores.')
