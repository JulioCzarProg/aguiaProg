// Importa a planilha de designações para o evento de congresso.
// Uso (dry-run):  node supabase/import-designacoes.mjs "caminho.xlsx"
//      (gravar):  node supabase/import-designacoes.mjs "caminho.xlsx" --gravar
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parseDesignacoes } from '../src/lib/parseDesignacoes.js'

const arquivo = process.argv[2]
const gravar = process.argv.includes('--gravar')
if (!arquivo) { console.error('Informe o caminho do .xlsx'); process.exit(1) }

const wb = XLSX.readFile(arquivo)
const abasTurno = wb.SheetNames.filter((n) => /MANHÃ|TARDE/i.test(n))
const abas = abasTurno.map((turno) => ({
  turno, rows: XLSX.utils.sheet_to_json(wb.Sheets[turno], { header: 1, defval: '' })
}))

const { setores, pessoas, designacoes, turnosDetectados } = parseDesignacoes(abas)

console.log('Turnos:', turnosDetectados.join(', '))
console.log('Setores:', setores.length, '→', setores.map((s) => s.codigo).join(' '))
console.log('Pessoas:', pessoas.length, '(capitães:', pessoas.filter((p) => p.funcao === 'capitao').length, ')')
console.log('Designações:', designacoes.length)

if (!gravar) { console.log('\n(dry-run — use --gravar para gravar no banco)'); process.exit(0) }

// ----- Gravação -----
const URL = 'https://hldpkgbrbciquxmtlrot.supabase.co'
const ANON = process.env.VITE_SUPABASE_ANON_KEY
if (!ANON) { console.error('Defina VITE_SUPABASE_ANON_KEY'); process.exit(1) }
const sb = createClient(URL, ANON, { auth: { persistSession: false } })

// Evento congresso
let { data: ev } = await sb.from('eventos').select('id').eq('tipo', 'congresso').order('created_at').limit(1).maybeSingle()
if (!ev) {
  const r = await sb.from('eventos').insert({ nome: 'Congresso Regional 2026', tipo: 'congresso', local: 'Ginásio Central', ativo: true }).select().single()
  ev = r.data
}
const eventoId = ev.id
console.log('Evento:', eventoId)

// Setores (upsert por evento+codigo). Limpa os antigos do evento primeiro.
await sb.from('setores').delete().eq('evento_id', eventoId)
const { data: setIns } = await sb.from('setores').insert(
  setores.map((s) => ({ evento_id: eventoId, codigo: s.codigo, nome: s.nome, cor: s.cor, descricao: s.grupo }))
).select()
const setorPorCodigo = Object.fromEntries((setIns || []).map((s) => [s.codigo, s.id]))
console.log('Setores gravados:', setIns?.length)

// Pessoas (upsert por telefone)
const { data: pesIns, error: pesErr } = await sb.from('usuarios')
  .upsert(pessoas.map((p) => ({ nome: p.nome, telefone: p.telefone, congregacao: p.congregacao, funcao: p.funcao })),
    { onConflict: 'telefone' }).select('id, telefone')
if (pesErr) { console.error('Erro pessoas:', pesErr.message); process.exit(1) }
const usuarioPorTel = Object.fromEntries((pesIns || []).map((u) => [u.telefone, u.id]))
console.log('Pessoas gravadas:', pesIns?.length)

// Designações (limpa as do evento e regrava)
await sb.from('designacoes').delete().eq('evento_id', eventoId)
const linhas = designacoes
  .map((d) => ({ evento_id: eventoId, usuario_id: usuarioPorTel[d.telefone], setor_id: setorPorCodigo[d.setorCodigo], turno: d.turno }))
  .filter((d) => d.usuario_id && d.setor_id)
// insere em lotes de 500
for (let i = 0; i < linhas.length; i += 500) {
  const { error } = await sb.from('designacoes').insert(linhas.slice(i, i + 500))
  if (error) { console.error('Erro designações:', error.message); process.exit(1) }
}
console.log('Designações gravadas:', linhas.length)
console.log('\n✅ Importação concluída.')
