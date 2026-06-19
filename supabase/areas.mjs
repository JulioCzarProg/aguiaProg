// Cria as ÁREAS (A/B/C/D) e designa os capitães por ÁREA (não por setor).
// Áreas são registros em `setores` com tipo='area' (codigo = a letra).
// Uso: VITE_SUPABASE_ANON_KEY=... node supabase/areas.mjs "caminho.xlsx"
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parseDesignacoes } from '../src/lib/parseDesignacoes.js'

const sb = createClient('https://hldpkgbrbciquxmtlrot.supabase.co', process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const wb = XLSX.readFile(process.argv[2])
const abas = wb.SheetNames.filter((n) => /MANHÃ|TARDE/i.test(n)).map((turno) => ({ turno, rows: XLSX.utils.sheet_to_json(wb.Sheets[turno], { header: 1, defval: '' }) }))
const { setores, capitaes } = parseDesignacoes(abas)

const { data: ev } = await sb.from('eventos').select('id').eq('tipo', 'congresso').order('created_at').limit(1).maybeSingle()

// 1) áreas a partir do prefixo do código + nome do grupo
const CORA = { A: 'azul', B: 'roxo', C: 'amarelo', D: 'verde' }
const areas = {}
for (const s of setores) { const L = (s.codigo.match(/^[A-Z]+/) || [''])[0]; if (L && !areas[L]) areas[L] = s.grupo || L }
const { data: exist } = await sb.from('setores').select('id, codigo').eq('evento_id', ev.id).eq('tipo', 'area')
const areaIdPorLetra = Object.fromEntries((exist || []).map((a) => [a.codigo, a.id]))
for (const [letra, nome] of Object.entries(areas)) {
  if (areaIdPorLetra[letra]) { await sb.from('setores').update({ nome, descricao: nome }).eq('id', areaIdPorLetra[letra]); continue }
  const { data } = await sb.from('setores').insert({ evento_id: ev.id, tipo: 'area', codigo: letra, nome, descricao: nome, cor: CORA[letra] || 'cinza' }).select('id').single()
  areaIdPorLetra[letra] = data.id
}
console.log('áreas:', Object.keys(areas).map((l) => `${l}=${areas[l]}`).join(' | '))

// 2) usuários (tel->id) e remove designações ANTIGAS de capitães (estavam em setores)
const { data: us } = await sb.from('usuarios').select('id, telefone, funcao')
const telId = Object.fromEntries(us.map((u) => [u.telefone, u.id]))
const capsIds = us.filter((u) => u.funcao === 'capitao').map((u) => u.id)
if (capsIds.length) await sb.from('designacoes').delete().eq('evento_id', ev.id).in('usuario_id', capsIds)

// 3) designa capitão -> ÁREA -> turno (dedupe)
const nomePorLetra = areas
const letraPorNome = Object.fromEntries(Object.entries(nomePorLetra).map(([l, n]) => [n, l]))
const vistos = new Set()
const linhas = []
for (const c of capitaes) {
  const uid = telId[c.telefone]; const letra = letraPorNome[c.grupo]; const aid = areaIdPorLetra[letra]
  if (!uid || !aid) continue
  const k = `${uid}|${aid}|${c.turno}`; if (vistos.has(k)) continue; vistos.add(k)
  linhas.push({ evento_id: ev.id, usuario_id: uid, setor_id: aid, turno: c.turno })
}
for (let i = 0; i < linhas.length; i += 500) await sb.from('designacoes').insert(linhas.slice(i, i + 500))
console.log('designações de capitão por área:', linhas.length)
