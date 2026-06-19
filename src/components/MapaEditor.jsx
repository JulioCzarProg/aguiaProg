import { useEffect, useRef, useState } from 'react'
import { Plus, MessageCircle, Phone, MapPin, X } from 'lucide-react'
import { supabase } from '../supabase'
import { corDe, LISTA_CORES } from './cores'
import { POS } from './MapaArquibancadas'

// Converte as posições do SVG (1080x1011) para o espaço do editor (imagem
// 1000x1000 com preserveAspectRatio meet): escala 0.926 e deslocamento Y ~32.
const ESC = 1000 / 1080, OFY = (1000 - 1011 * (1000 / 1080)) / 2
const posSvg = (cod) => { const p = POS[cod]; return p ? [p[0] * ESC, p[1] * ESC + OFY] : null }

// ===================================================================
// Editor de mapa do ginásio. Setores = blocos editáveis (mover, girar,
// redimensionar, cor, código, camada). Fundo: oval achatado, palco,
// arquibancadas e quadra de vôlei centralizada com 6 blocos.
// ===================================================================
const SZ = 1000
const PAD = 28 // margem do viewBox (reduz o mapa para não cortar nas bordas)
const TAU = Math.PI / 180
const rot = (vx, vy, deg) => {
  const a = deg * TAU, c = Math.cos(a), s = Math.sin(a)
  return [vx * c - vy * s, vx * s + vy * c]
}

export default function MapaEditor({
  setores = [], presencas = [], editavel = false, camada = 1, mapaUrl,
  onSetorClick, onUserClick, setorSelecionado, eventoId, recarregar
}) {
  const [arr, setArr] = useState(setores)
  const [sel, setSel] = useState(null)
  const [menu, setMenu] = useState(null)
  const [popup, setPopup] = useState(null) // { x, y, user }
  const svgRef = useRef(null)
  const drag = useRef(null)
  const lp = useRef(null)

  useEffect(() => { setArr(setores) }, [setores])
  useEffect(() => {
    const fecha = () => setMenu(null)
    window.addEventListener('click', fecha)
    return () => window.removeEventListener('click', fecha)
  }, [])

  const porSetor = {}
  presencas.forEach((p) => { (porSetor[p.codigo] ||= []).push(p) })

  const visiveis = arr.filter((s) => camada === 'all' || (s.camada ?? 1) === camada)
  const pontosDe = (s) => (Array.isArray(s.pontos) && s.pontos.length >= 3) ? s.pontos : null
  const centro = (s) => {
    const pts = pontosDe(s)
    if (pts) { const n = pts.length; return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n] }
    return [Number(s.pos_x) + Number(s.largura) / 2, Number(s.pos_y) + Number(s.altura) / 2]
  }

  function paraSvg(e) {
    const r = svgRef.current.getBoundingClientRect()
    const total = SZ + 2 * PAD
    return { x: -PAD + (e.clientX - r.left) / r.width * total, y: -PAD + (e.clientY - r.top) / r.height * total }
  }

  function iniciar(e, s, modo) {
    if (!editavel) { onSetorClick?.(s); return }
    e.stopPropagation()
    setSel(s.id); setMenu(null)
    const p = paraSvg(e)
    drag.current = { modo, id: s.id, ini: p, g0: { px: +s.pos_x, py: +s.pos_y, w: +s.largura, h: +s.altura, r: +s.rotacao || 0, pontos: pontosDe(s) ? s.pontos.map((q) => [...q]) : null }, moveu: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (e.pointerType === 'touch' && modo === 'move') {
      lp.current = setTimeout(() => { abrirMenu(e.clientX, e.clientY, s); drag.current = null }, 550)
    }
  }

  function mover(e) {
    const d = drag.current; if (!d) return
    const p = paraSvg(e)
    const dx = p.x - d.ini.x, dy = p.y - d.ini.y
    if (Math.abs(dx) + Math.abs(dy) > 6) { d.moveu = true; clearTimeout(lp.current) }
    setArr((prev) => prev.map((s) => {
      if (s.id !== d.id) return s
      const g = d.g0
      // --- Polígonos (arquibancadas): mover/girar/redimensionar os pontos ---
      if (g.pontos) {
        const n = g.pontos.length
        const ccx = g.pontos.reduce((a, q) => a + q[0], 0) / n
        const ccy = g.pontos.reduce((a, q) => a + q[1], 0) / n
        if (d.modo === 'move') return { ...s, pontos: g.pontos.map(([x, y]) => [x + dx, y + dy]) }
        if (d.modo === 'resize') {
          const dist = (a, b, cx, cy) => Math.hypot(a - cx, b - cy)
          const f = Math.max(0.25, dist(p.x, p.y, ccx, ccy) / Math.max(1, dist(d.ini.x, d.ini.y, ccx, ccy)))
          return { ...s, pontos: g.pontos.map(([x, y]) => [ccx + (x - ccx) * f, ccy + (y - ccy) * f]) }
        }
        if (d.modo === 'rotate') {
          const da = Math.atan2(p.y - ccy, p.x - ccx) - Math.atan2(d.ini.y - ccy, d.ini.x - ccx)
          const co = Math.cos(da), si = Math.sin(da)
          return { ...s, pontos: g.pontos.map(([x, y]) => { const ux = x - ccx, uy = y - ccy; return [ccx + ux * co - uy * si, ccy + ux * si + uy * co] }) }
        }
        return s
      }
      // --- Retângulos (blocos/palco/tela/setor simples) ---
      if (d.modo === 'move') return { ...s, pos_x: g.px + dx, pos_y: g.py + dy }
      const cx = g.px + g.w / 2, cy = g.py + g.h / 2
      if (d.modo === 'resize') {
        const [lx, ly] = rot(p.x - cx, p.y - cy, -(g.r))
        const w = Math.max(40, Math.abs(lx) * 2), h = Math.max(28, Math.abs(ly) * 2)
        return { ...s, pos_x: cx - w / 2, pos_y: cy - h / 2, largura: w, altura: h }
      }
      if (d.modo === 'rotate') {
        const ang = Math.atan2(p.y - cy, p.x - cx) / TAU + 90
        return { ...s, rotacao: Math.round(ang) }
      }
      return s
    }))
  }

  async function soltar() {
    const d = drag.current; clearTimeout(lp.current); drag.current = null
    if (!d || !d.moveu) return
    const s = arr.find((x) => x.id === d.id); if (!s) return
    const pts = pontosDe(s)
    if (pts) {
      await supabase.from('setores').update({ pontos: pts.map(([x, y]) => [Math.round(x), Math.round(y)]) }).eq('id', s.id)
    } else {
      await supabase.from('setores').update({
        pos_x: Math.round(s.pos_x), pos_y: Math.round(s.pos_y),
        largura: Math.round(s.largura), altura: Math.round(s.altura), rotacao: Math.round(s.rotacao || 0)
      }).eq('id', s.id)
    }
  }

  function abrirMenu(clientX, clientY, s) {
    const r = svgRef.current.getBoundingClientRect()
    setMenu({ x: clientX - r.left, y: clientY - r.top, setor: s })
    setSel(s.id)
  }

  async function patch(id, campos) {
    await supabase.from('setores').update(campos).eq('id', id)
    recarregar?.()
  }
  async function excluir(id) {
    if (!confirm('Excluir este setor?')) return
    await supabase.from('setores').delete().eq('id', id)
    setMenu(null); recarregar?.()
  }
  const camNum = (camada === 1 || camada === 2) ? camada : 1
  async function adicionar(tipo) {
    const base = { evento_id: eventoId, camada: camNum, rotacao: 0, pos_x: 450, pos_y: 470, tipo }
    let extra
    if (tipo === 'setor') { const codigo = prompt('Código do novo setor:', 'NOVO'); if (!codigo) return; extra = { codigo, nome: codigo, cor: 'azul', largura: 90, altura: 60 } }
    else if (tipo === 'bloco') extra = { codigo: 'Bloco', nome: 'Bloco', cor: 'cinza', largura: 120, altura: 96 }
    else if (tipo === 'palco') extra = { codigo: 'PALCO', nome: 'Palco', cor: 'cinza', pos_x: 60, pos_y: 410, largura: 56, altura: 180 }
    else extra = { codigo: 'TELA', nome: 'Tela', cor: 'cinza', pos_x: 130, pos_y: 420, largura: 120, altura: 70 }
    await supabase.from('setores').insert({ ...base, ...extra })
    recarregar?.()
  }
  // adiciona uma forma geométrica (visual): circulo, oval, quadrado, retangulo, meialua
  async function adicionarForma(forma) {
    const codigo = (prompt('Código do setor para esta forma (opcional):', '') || '').trim()
    const quad = forma === 'quadrado' || forma === 'circulo'
    await supabase.from('setores').insert({
      evento_id: eventoId, camada: camNum, tipo: 'forma', codigo, nome: codigo || 'Forma',
      cor: 'azul', rotacao: 0, pos_x: 450, pos_y: 460, largura: quad ? 90 : 120, altura: 90, pontos: { forma }
    })
    recarregar?.()
  }
  // duplica um elemento (mesmo código) só para visualização no mapa
  async function duplicar(s) {
    await supabase.from('setores').insert({
      evento_id: eventoId, camada: s.camada ?? 1, tipo: 'forma', codigo: s.codigo, nome: s.nome, cor: s.cor,
      rotacao: +s.rotacao || 0, pos_x: (+s.pos_x || 450) + 40, pos_y: (+s.pos_y || 460) + 40,
      largura: +s.largura || 100, altura: +s.altura || 90,
      pontos: (s.pontos && !Array.isArray(s.pontos)) ? s.pontos : { forma: 'retangulo' }
    })
    setMenu(null); recarregar?.()
  }

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} viewBox={`${-PAD} ${-PAD} ${SZ + 2 * PAD} ${SZ + 2 * PAD}`}
        className="w-full h-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 select-none touch-none"
        onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}
        onClick={(e) => { if (editavel && e.target === e.currentTarget) setSel(null); setPopup(null) }}>
        <defs>
          {/* hachura zebrada (riscos finos) por cor — camada 2 fica em 2º plano */}
          {LISTA_CORES.map((nome) => (
            <pattern key={nome} id={`zebra-${nome}`} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="7" stroke={corDe(nome).bg} strokeWidth="1.4" />
            </pattern>
          ))}
        </defs>

        {/* Fundo: o MESMO mapa da visualização, por camada
            (camada 1 = arquibancadas; camada 2 = planta interna em PNG p/ mobile).
            href + xlinkHref para compatibilidade com Safari/iOS. */}
        {(() => {
          const base = camada === 2 ? '/planta-interna.png' : (mapaUrl || '/mapa-arquibancadas.svg')
          return <image href={base} xlinkHref={base} x="0" y="0" width={SZ} height={SZ} preserveAspectRatio="xMidYMid meet" />
        })()}

        {/* Camada 1: usa a geometria do PRÓPRIO SVG — só pontos de presença
            e áreas de clique nas posições dos setores (sem redesenhar). */}
        {camada !== 2 && arr.filter((s) => posSvg(s.codigo)).map((s) => {
          const [px, py] = posSvg(s.codigo)
          const presentes = porSetor[s.codigo] || []
          return (
            <g key={'p1-' + s.id}>
              {onSetorClick && <circle cx={px} cy={py} r="22" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onSetorClick(s)} />}
              {presentes.slice(0, 8).map((pr, i) => {
                const ang = (i / 8) * Math.PI * 2
                const dx = px + Math.cos(ang) * 20, dy = py + Math.sin(ang) * 20
                return (
                  <circle key={pr.id} cx={dx} cy={dy} r="6" fill={pr.atrasado ? '#9ca3af' : '#22c55e'} stroke="#fff" strokeWidth="1.5"
                    pointerEvents={onUserClick ? 'auto' : 'none'} style={{ cursor: onUserClick ? 'pointer' : 'default' }}
                    onClick={(e) => { if (onUserClick) { const rr = svgRef.current.parentElement.getBoundingClientRect(); setPopup({ x: e.clientX - rr.left, y: e.clientY - rr.top, user: pr }) } }}>
                    {!pr.atrasado && <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />}
                  </circle>
                )
              })}
              {presentes.length > 8 && <text x={px} y={py - 26} fontSize="14" fill="#16a34a" textAnchor="middle" fontWeight="800">+{presentes.length}</text>}
            </g>
          )
        })}

        {/* Elementos editáveis: formas inseridas + setores internos (fora do SVG).
            Os setores do SVG (C/D com POS) NÃO são redesenhados aqui. */}
        {visiveis.filter((s) => s.tipo !== 'area' && !(((s.tipo || 'setor') === 'setor') && posSvg(s.codigo))).map((s) => {
          const [cx, cy] = centro(s)
          const c = corDe(s.cor)
          const selecionado = s.id === setorSelecionado || s.id === sel
          const r = +s.rotacao || 0
          const tipo = s.tipo || 'setor'
          const presentes = porSetor[s.codigo] || []
          const ix = +s.pos_x, iy = +s.pos_y, iw = +s.largura, ih = +s.altura
          const pts = pontosDe(s)
          const forma = (s.pontos && !Array.isArray(s.pontos) && s.pontos.forma) || null
          const z2 = (s.camada ?? 1) === 2 // camada 2 = 2º plano (zebrado/fino)
          const comum = {
            style: { cursor: editavel ? 'move' : (onSetorClick ? 'pointer' : 'default') },
            onPointerDown: (e) => iniciar(e, s, 'move'),
            onContextMenu: (e) => { e.preventDefault(); editavel && abrirMenu(e.clientX, e.clientY, s) }
          }
          return (
            <g key={s.id}>
              {pts && <>
                <polygon points={pts.map((q) => q.join(',')).join(' ')}
                  fill={z2 ? `url(#zebra-${s.cor})` : c.bg} fillOpacity={z2 ? 0.85 : (selecionado ? 0.32 : 0.16)}
                  stroke={c.bg} strokeWidth={z2 ? 1.5 : (selecionado ? 6 : 3.5)} strokeDasharray={z2 ? '5 4' : undefined}
                  strokeLinejoin="round" {...comum} />
                <circle cx={cx} cy={cy} r="17" fill={c.bg} stroke="#fff" strokeWidth="2" pointerEvents="none" />
                <text x={cx} y={cy + 5} fontSize="15" fontWeight="800" fill="#fff" textAnchor="middle" pointerEvents="none">{s.codigo}</text>
                {editavel && selecionado && (() => {
                  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
                  const maxx = Math.max(...xs), maxy = Math.max(...ys), miny = Math.min(...ys)
                  return <>
                    <line x1={cx} y1={miny} x2={cx} y2={miny - 26} stroke="#0f172a" strokeWidth="1.5" />
                    <circle cx={cx} cy={miny - 30} r="9" fill="#0f172a" style={{ cursor: 'grab' }} onPointerDown={(e) => iniciar(e, s, 'rotate')} />
                    <rect x={maxx - 9} y={maxy - 9} width="18" height="18" rx="3" fill="#0f172a" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => iniciar(e, s, 'resize')} />
                  </>
                })()}
              </>}
              {!pts && <g transform={`rotate(${r} ${cx} ${cy})`}>
                {forma && <>
                  {(() => {
                    const fill = z2 ? `url(#zebra-${s.cor})` : c.bg
                    const fop = z2 ? 0.85 : (selecionado ? 0.3 : 0.16)
                    const sw = z2 ? 1.5 : (selecionado ? 5 : 3)
                    const com = { fill, fillOpacity: fop, stroke: c.bg, strokeWidth: sw, strokeDasharray: z2 ? '5 4' : undefined, ...comum }
                    if (forma === 'circulo') return <circle cx={cx} cy={cy} r={Math.min(iw, ih) / 2} {...com} />
                    if (forma === 'oval') return <ellipse cx={cx} cy={cy} rx={iw / 2} ry={ih / 2} {...com} />
                    if (forma === 'meialua') return <path d={`M ${ix} ${cy} A ${iw / 2} ${ih / 2} 0 0 1 ${ix + iw} ${cy} Z`} {...com} />
                    return <rect x={ix} y={iy} width={iw} height={ih} rx={forma === 'quadrado' ? 4 : 6} {...com} />
                  })()}
                  {s.codigo && <>
                    <circle cx={cx} cy={cy} r="15" fill={c.bg} stroke="#fff" strokeWidth="2" pointerEvents="none" />
                    <text x={cx} y={cy + 5} fontSize="14" fontWeight="800" fill="#fff" textAnchor="middle" transform={`rotate(${-r} ${cx} ${cy})`} pointerEvents="none">{s.codigo}</text>
                  </>}
                </>}
                {!forma && <>
                {tipo === 'palco' && <>
                  <rect x={ix} y={iy} width={iw} height={ih} rx="6" fill="#1e293b" stroke={selecionado ? '#0f172a' : '#0f172a'} strokeWidth={selecionado ? 4 : 1} {...comum} />
                  <text x={cx} y={cy + 6} fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" transform={`rotate(${-r} ${cx} ${cy})`} pointerEvents="none">{s.codigo || 'PALCO'}</text>
                </>}
                {tipo === 'tela' && <>
                  <rect x={ix} y={iy} width={iw} height={ih} rx="4" fill="#0f2a4d" stroke="#60a5fa" strokeWidth={selecionado ? 4 : 2} {...comum} />
                  <text x={cx} y={cy + 5} fontSize="14" fontWeight="800" fill="#bfdbfe" textAnchor="middle" transform={`rotate(${-r} ${cx} ${cy})`} pointerEvents="none">{s.codigo || 'TELA'}</text>
                </>}
                {tipo === 'bloco' && <>
                  <rect x={ix} y={iy} width={iw} height={ih} rx="4" fill="#eef2f7" stroke={selecionado ? '#0f172a' : '#cbd5e1'} strokeWidth={selecionado ? 3 : 1.5} {...comum} />
                  {[0.28, 0.5, 0.72].map((f, k) => (
                    <line key={k} x1={ix + 6} y1={iy + ih * f} x2={ix + iw - 6} y2={iy + ih * f} stroke="#dbe2ea" strokeWidth="3" pointerEvents="none" />
                  ))}
                  <text x={cx} y={cy + 4} fontSize="12" fontWeight="700" fill="#64748b" textAnchor="middle" transform={`rotate(${-r} ${cx} ${cy})`} pointerEvents="none">{s.codigo}</text>
                </>}
                {tipo === 'setor' && <>
                  <rect x={ix} y={iy} width={iw} height={ih} rx="6"
                    fill={z2 ? `url(#zebra-${s.cor})` : c.bg} fillOpacity={z2 ? 0.85 : (selecionado ? 0.3 : 0.16)}
                    stroke={c.bg} strokeWidth={z2 ? 1.5 : (selecionado ? 5 : 3)} strokeDasharray={z2 ? '5 4' : undefined}
                    strokeLinejoin="round" {...comum} />
                  <circle cx={cx} cy={cy} r="17" fill={c.bg} stroke="#fff" strokeWidth="2" pointerEvents="none" />
                  <text x={cx} y={cy + 5} fontSize="15" fontWeight="800" fill="#fff" textAnchor="middle"
                    transform={`rotate(${-r} ${cx} ${cy})`} pointerEvents="none">{s.codigo}</text>
                </>}
                </>}

                {editavel && selecionado && (
                  <>
                    {/* alça de rotação */}
                    <line x1={cx} y1={s.pos_y} x2={cx} y2={s.pos_y - 26} stroke="#0f172a" strokeWidth="1.5" />
                    <circle cx={cx} cy={s.pos_y - 30} r="9" fill="#0f172a"
                      style={{ cursor: 'grab' }} onPointerDown={(e) => iniciar(e, s, 'rotate')} />
                    {/* alça de redimensionar */}
                    <rect x={+s.pos_x + +s.largura - 9} y={+s.pos_y + +s.altura - 9} width="18" height="18" rx="3"
                      fill="#0f172a" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => iniciar(e, s, 'resize')} />
                  </>
                )}
              </g>}

              {/* presença ao vivo (fora da rotação) */}
              {presentes.slice(0, 8).map((pr, i) => {
                const ang = (i / 8) * Math.PI * 2
                return (
                  <circle key={pr.id} cx={cx + Math.cos(ang) * 30} cy={cy + Math.sin(ang) * 30} r="6"
                    fill={pr.atrasado ? '#9ca3af' : '#22c55e'} stroke="#fff" strokeWidth="1.5"
                    pointerEvents={onUserClick ? 'auto' : 'none'} style={{ cursor: onUserClick ? 'pointer' : 'default' }}
                    onClick={(e) => { if (onUserClick) { const rr = svgRef.current.parentElement.getBoundingClientRect(); setPopup({ x: e.clientX - rr.left, y: e.clientY - rr.top, user: pr }) } }}>
                    {!pr.atrasado && <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />}
                  </circle>
                )
              })}
              {presentes.length > 8 && (
                <text x={cx} y={cy - 34} fontSize="14" fill="#16a34a" textAnchor="middle" fontWeight="800" pointerEvents="none">+{presentes.length}</text>
              )}
            </g>
          )
        })}
      </svg>

      {editavel && (
        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%]">
          <button onClick={() => adicionar('setor')} className="btn-primary !min-h-[34px] text-xs shadow"><Plus size={13} /> Setor</button>
          <button onClick={() => adicionarForma('retangulo')} className="btn-ghost !min-h-[34px] text-xs shadow">▭ Retângulo</button>
          <button onClick={() => adicionarForma('quadrado')} className="btn-ghost !min-h-[34px] text-xs shadow">◻ Quadrado</button>
          <button onClick={() => adicionarForma('circulo')} className="btn-ghost !min-h-[34px] text-xs shadow">○ Círculo</button>
          <button onClick={() => adicionarForma('oval')} className="btn-ghost !min-h-[34px] text-xs shadow">⬭ Oval</button>
          <button onClick={() => adicionarForma('meialua')} className="btn-ghost !min-h-[34px] text-xs shadow">◗ Meia-lua</button>
          <button onClick={() => adicionar('bloco')} className="btn-ghost !min-h-[34px] text-xs shadow">+ Bloco</button>
        </div>
      )}

      {/* Menu de contexto */}
      {menu && (
        <div className="absolute z-30 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-lg p-2 w-56 text-sm"
          style={{ top: menu.y, left: Math.min(menu.x, 999) }} onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold px-1 pb-1">Setor {menu.setor.codigo}</div>
          <div className="flex flex-wrap gap-1.5 px-1 py-1">
            {LISTA_CORES.map((nome) => (
              <button key={nome} onClick={() => patch(menu.setor.id, { cor: nome })}
                className={`w-7 h-7 rounded-full border-2 ${menu.setor.cor === nome ? 'border-gray-800 dark:border-white' : 'border-transparent'}`}
                style={{ background: corDe(nome).bg }} title={corDe(nome).label} />
            ))}
          </div>
          <button onClick={() => { const v = prompt('Código do setor:', menu.setor.codigo); if (v) patch(menu.setor.id, { codigo: v }) }}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700">Editar código</button>
          <button onClick={() => patch(menu.setor.id, { camada: (menu.setor.camada ?? 1) === 1 ? 2 : 1 })}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
            Mover p/ camada {(menu.setor.camada ?? 1) === 1 ? '2' : '1'}
          </button>
          <button onClick={() => duplicar(menu.setor)}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
            Duplicar (mesmo código, outra área)
          </button>
          <button onClick={() => excluir(menu.setor.id)}
            className="block w-full text-left px-2 py-1.5 rounded text-urgencia hover:bg-red-50 dark:hover:bg-red-900/30">Excluir setor</button>
        </div>
      )}

      {/* Popup do voluntário (clicar num ponto de presença) */}
      {popup && (
        <div className="absolute z-30 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 overflow-hidden"
          style={{ top: Math.min(popup.y, 560), left: Math.min(popup.x, 700) }} onClick={(e) => e.stopPropagation()}>
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
