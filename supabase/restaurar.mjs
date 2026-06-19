// Restaura setores e designações que faltam (não destrutivo).
// Uso: VITE_SUPABASE_ANON_KEY=... node supabase/restaurar.mjs "caminho.xlsx"
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parseDesignacoes } from '../src/lib/parseDesignacoes.js'

const arquivo = process.argv[2]
const sb = createClient('https://hldpkgbrbciquxmtlrot.supabase.co', process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const wb = XLSX.readFile(arquivo)
const abas = wb.SheetNames.filter((n) => /MANHÃ|TARDE/i.test(n)).map((turno) => ({ turno, rows: XLSX.utils.sheet_to_json(wb.Sheets[turno], { header: 1, defval: '' }) }))
const { setores, pessoas, designacoes, capitaes } = parseDesignacoes(abas)

const { data: ev } = await sb.from('eventos').select('id').eq('tipo', 'congresso').order('created_at').limit(1).maybeSingle()

// 1) usuários (upsert por telefone, não duplica)
await sb.from('usuarios').upsert(pessoas.map((p) => ({ nome: p.nome, telefone: p.telefone, congregacao: p.congregacao, funcao: p.funcao })), { onConflict: 'telefone' })
const { data: us } = await sb.from('usuarios').select('id, telefone')
const usuarioPorTel = Object.fromEntries(us.map((u) => [u.telefone, u.id]))

// 2) setores: insere os que faltam
const { data: stExist } = await sb.from('setores').select('id, codigo').eq('evento_id', ev.id)
const codigoPorId = Object.fromEntries(stExist.map((s) => [s.codigo, s.id]))
const faltando = setores.filter((s) => !codigoPorId[s.codigo])
if (faltando.length) {
  const { data: novos } = await sb.from('setores').insert(
    faltando.map((s) => ({ evento_id: ev.id, codigo: s.codigo, nome: s.nome, cor: s.cor, descricao: s.grupo, tipo: 'setor' }))
  ).select('id, codigo')
  novos.forEach((s) => { codigoPorId[s.codigo] = s.id })
}
console.log('setores restaurados:', faltando.length, '->', faltando.map((s) => s.codigo).join(' '))

// 3) representante de grupo (para capitães)
const grupoPorCodigo = Object.fromEntries(setores.map((s) => [s.codigo, s.grupo]))
const repPorGrupo = {}
for (const s of setores) { if (s.grupo && !repPorGrupo[s.grupo]) repPorGrupo[s.grupo] = codigoPorId[s.codigo] }

// 4) designações que faltam (dedupe por usuario|setor|turno)
const { data: dsExist } = await sb.from('designacoes').select('usuario_id, setor_id, turno').eq('evento_id', ev.id)
const chaves = new Set((dsExist || []).map((d) => `${d.usuario_id}|${d.setor_id}|${d.turno}`))
const novasDes = []
for (const d of designacoes) {
  const uid = usuarioPorTel[d.telefone], sid = codigoPorId[d.setorCodigo]
  if (!uid || !sid) continue
  const k = `${uid}|${sid}|${d.turno}`
  if (chaves.has(k)) continue
  chaves.add(k); novasDes.push({ evento_id: ev.id, usuario_id: uid, setor_id: sid, turno: d.turno })
}
for (const c of capitaes) {
  const uid = usuarioPorTel[c.telefone], sid = repPorGrupo[c.grupo]
  if (!uid || !sid) continue
  const k = `${uid}|${sid}|${c.turno}`
  if (chaves.has(k)) continue
  chaves.add(k); novasDes.push({ evento_id: ev.id, usuario_id: uid, setor_id: sid, turno: c.turno })
}
for (let i = 0; i < novasDes.length; i += 500) await sb.from('designacoes').insert(novasDes.slice(i, i + 500))
console.log('designações restauradas:', novasDes.length)

const { data: fin } = await sb.from('setores').select('codigo').eq('evento_id', ev.id).or('tipo.is.null,tipo.eq.setor')
console.log('setores tipo=setor agora:', fin.length)
void grupoPorCodigo
