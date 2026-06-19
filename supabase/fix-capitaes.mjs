// Cria designações para os capitães (capitão -> setor representante do seu
// grupo, no seu turno), corrigindo "sem setor designado" e o filtro do chat.
// Uso: VITE_SUPABASE_ANON_KEY=... node supabase/fix-capitaes.mjs "caminho.xlsx"
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parseDesignacoes } from '../src/lib/parseDesignacoes.js'

const arquivo = process.argv[2]
if (!arquivo) { console.error('Informe o caminho do .xlsx'); process.exit(1) }
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const sb = createClient('https://hldpkgbrbciquxmtlrot.supabase.co', ANON, { auth: { persistSession: false } })

const wb = XLSX.readFile(arquivo)
const abas = wb.SheetNames.filter((n) => /MANHÃ|TARDE/i.test(n))
  .map((turno) => ({ turno, rows: XLSX.utils.sheet_to_json(wb.Sheets[turno], { header: 1, defval: '' }) }))
const { capitaes } = parseDesignacoes(abas)
console.log('capitães detectados:', capitaes.length)

const { data: ev } = await sb.from('eventos').select('id').eq('tipo', 'congresso').order('created_at').limit(1).maybeSingle()
const { data: setores } = await sb.from('setores').select('id, codigo, descricao').eq('evento_id', ev.id)
const { data: usuarios } = await sb.from('usuarios').select('id, telefone')
const usuarioPorTel = Object.fromEntries((usuarios || []).map((u) => [u.telefone, u.id]))
// setor representante por grupo (descricao)
const repPorGrupo = {}
for (const s of setores || []) { if (s.descricao && !repPorGrupo[s.descricao]) repPorGrupo[s.descricao] = s.id }

let criadas = 0, semGrupo = 0, semUser = 0
for (const c of capitaes) {
  const uid = usuarioPorTel[c.telefone]; if (!uid) { semUser++; continue }
  const setorId = repPorGrupo[c.grupo]; if (!setorId) { semGrupo++; continue }
  const { data: existe } = await sb.from('designacoes').select('id')
    .eq('evento_id', ev.id).eq('usuario_id', uid).eq('setor_id', setorId).eq('turno', c.turno).limit(1)
  if (existe && existe.length) continue
  const { error } = await sb.from('designacoes').insert({ evento_id: ev.id, usuario_id: uid, setor_id: setorId, turno: c.turno })
  if (!error) criadas++
}
console.log(`designações de capitão criadas: ${criadas} (sem grupo correspondente: ${semGrupo}, sem usuário: ${semUser})`)
