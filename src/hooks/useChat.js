import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, uploadArquivo } from '../supabase'
import { useAuth } from '../contexts/AuthContext'

// Beep de alerta via Web Audio API (para mensagens urgentes)
let audioCtx
export function tocarAlerta() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.connect(g); g.connect(audioCtx.destination)
    o.type = 'square'; o.frequency.value = 880
    g.gain.setValueAtTime(0.001, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4)
    o.start(); o.stop(audioCtx.currentTime + 0.4)
    navigator.vibrate?.([200, 100, 200])
  } catch { /* ignore */ }
}

export function useChat(canalId) {
  const { usuario } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const idsRef = useRef(new Set())

  // Carrega histórico
  useEffect(() => {
    if (!canalId) return
    setCarregando(true)
    idsRef.current = new Set()
    supabase.from('mensagens')
      .select('*')
      .eq('canal_id', canalId)
      .order('created_at', { ascending: true })
      .limit(300)
      .then(({ data }) => {
        const lista = data || []
        lista.forEach((m) => idsRef.current.add(m.id))
        setMensagens(lista)
        setCarregando(false)
      })
  }, [canalId])

  // Realtime
  useEffect(() => {
    if (!canalId) return
    const canal = supabase
      .channel('chat-' + canalId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `canal_id=eq.${canalId}` },
        (payload) => {
          const m = payload.new
          if (idsRef.current.has(m.id)) return
          idsRef.current.add(m.id)
          setMensagens((prev) => [...prev, m])
          if (m.urgente && m.usuario_id !== usuario?.id) tocarAlerta()
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'mensagens' },
        (payload) => {
          const id = payload.old?.id
          if (!id) return
          idsRef.current.delete(id)
          setMensagens((prev) => prev.filter((x) => x.id !== id))
        })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [canalId, usuario?.id])

  // Apaga uma mensagem (apaga para todos via realtime DELETE)
  const apagarMensagem = useCallback(async (id) => {
    setMensagens((prev) => prev.filter((x) => x.id !== id))
    idsRef.current.delete(id)
    await supabase.from('mensagens').delete().eq('id', id)
  }, [])

  const enviarTexto = useCallback(async (texto, urgente = false) => {
    if (!texto?.trim()) return
    await supabase.from('mensagens').insert({
      canal_id: canalId, usuario_id: usuario.id,
      nome_autor: usuario.nome, funcao_autor: usuario.funcao,
      texto: texto.trim(), tipo: 'texto', urgente
    })
  }, [canalId, usuario])

  const enviarArquivo = useCallback(async (file, tipo, extra = {}) => {
    const bucket = tipo === 'audio' ? 'chat-audios' : 'chat-fotos'
    const ext = tipo === 'audio' ? '.webm' : '.' + (file.name?.split('.').pop() || 'jpg')
    const url = await uploadArquivo(bucket, file, ext)
    await supabase.from('mensagens').insert({
      canal_id: canalId, usuario_id: usuario.id,
      nome_autor: usuario.nome, funcao_autor: usuario.funcao,
      tipo, arquivo_url: url, ...extra
    })
  }, [canalId, usuario])

  return { mensagens, carregando, enviarTexto, enviarArquivo, apagarMensagem }
}
