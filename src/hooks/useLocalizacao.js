import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'

// Faz upsert da localização do usuário (chave única usuario_id)
async function salvarLocalizacao(usuarioId, dados) {
  return supabase.from('localizacoes').upsert(
    { usuario_id: usuarioId, ...dados, updated_at: new Date().toISOString() },
    { onConflict: 'usuario_id' }
  )
}

/**
 * Atualiza GPS a cada `intervalo` ms (padrão 30s) quando `automatico` é true.
 * Também expõe enviarAgora() e marcarManual(setorId) para ginásio fechado.
 */
export function useLocalizacao({ automatico = false, intervalo = 30000 } = {}) {
  const { usuario } = useAuth()
  const [status, setStatus] = useState('ocioso') // ocioso | enviando | ok | erro
  const timer = useRef(null)

  const enviarAgora = useCallback(() => {
    if (!usuario || !navigator.geolocation) {
      setStatus('erro'); return Promise.reject(new Error('GPS indisponível'))
    }
    setStatus('enviando')
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await salvarLocalizacao(usuario.id, {
            latitude: pos.coords.latitude, longitude: pos.coords.longitude
          })
          setStatus('ok'); resolve(pos.coords)
        },
        (err) => { setStatus('erro'); reject(err) },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }, [usuario])

  // Marcação manual de setor (modo ginásio fechado)
  const marcarManual = useCallback(async (setorId) => {
    if (!usuario) return
    setStatus('enviando')
    const { error } = await salvarLocalizacao(usuario.id, { setor_id: setorId })
    setStatus(error ? 'erro' : 'ok')
  }, [usuario])

  useEffect(() => {
    if (!automatico) return
    enviarAgora().catch(() => {})
    timer.current = setInterval(() => enviarAgora().catch(() => {}), intervalo)
    return () => clearInterval(timer.current)
  }, [automatico, intervalo, enviarAgora])

  return { status, enviarAgora, marcarManual }
}
