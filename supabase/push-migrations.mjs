// Aplica as migrações de supabase/migrations/ via Management API do Supabase.
// Uso: SUPABASE_PAT=sbp_xxx node supabase/push-migrations.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REF = 'hldpkgbrbciquxmtlrot'
const PAT = process.env.SUPABASE_PAT
if (!PAT) { console.error('Defina SUPABASE_PAT'); process.exit(1) }

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const url = `https://api.supabase.com/v1/projects/${REF}/database/query`

for (const f of arquivos) {
  const query = readFileSync(join(dir, f), 'utf8')
  process.stdout.write(`→ ${f} … `)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  const txt = await res.text()
  if (!res.ok) {
    console.log('ERRO')
    console.error(txt)
    process.exit(1)
  }
  console.log('ok')
}
console.log('\nTodas as migrações aplicadas com sucesso.')
