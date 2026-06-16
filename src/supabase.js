import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Ajuda a diagnosticar .env ausente em vez de uma tela branca.
  console.error('[Indicador360] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
})

// Upload helper para os buckets de storage
export async function uploadArquivo(bucket, file, ext = '') {
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const { error } = await supabase.storage.from(bucket).upload(nome, file, {
    cacheControl: '3600',
    upsert: false
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(nome)
  return data.publicUrl
}
