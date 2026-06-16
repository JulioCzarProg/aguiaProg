// Faz deploy de uma Edge Function via Management API do Supabase.
// Uso: SUPABASE_PAT=sbp_xxx node supabase/deploy-funcao.mjs enviar-codigo
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REF = 'hldpkgbrbciquxmtlrot'
const PAT = process.env.SUPABASE_PAT
const slug = process.argv[2]
if (!PAT || !slug) { console.error('Uso: SUPABASE_PAT=... node deploy-funcao.mjs <slug>'); process.exit(1) }

const dir = dirname(fileURLToPath(import.meta.url))
const codigo = readFileSync(join(dir, 'functions', slug, 'index.ts'), 'utf8')
const base = `https://api.supabase.com/v1/projects/${REF}/functions`
const auth = { Authorization: `Bearer ${PAT}` }

// multipart deploy (API atual)
const meta = { name: slug, entrypoint_path: 'index.ts', verify_jwt: true }
const fd = new FormData()
fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
fd.append('file', new Blob([codigo], { type: 'application/typescript' }), 'index.ts')

const res = await fetch(`${base}/deploy?slug=${slug}`, { method: 'POST', headers: auth, body: fd })
const txt = await res.text()
console.log('deploy status:', res.status)
console.log(txt.slice(0, 800))
if (!res.ok) process.exit(1)
console.log('\n✅ Função', slug, 'publicada.')
