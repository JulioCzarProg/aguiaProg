import { useEffect, useRef } from 'react'
import { supabase } from '../supabase'

/**
 * Assina mudanças postgres_changes de uma tabela via Supabase Realtime.
 * @param {string} tabela  nome da tabela
 * @param {object} opts    { filtro, evento, onInsert, onUpdate, onDelete, ativo }
 */
export function useRealtime(tabela, { filtro, evento = '*', onInsert, onUpdate, onDelete, ativo = true } = {}) {
  const cbs = useRef({})
  cbs.current = { onInsert, onUpdate, onDelete }

  useEffect(() => {
    if (!ativo) return
    const nome = `rt-${tabela}-${filtro || 'all'}-${Math.random().toString(36).slice(2)}`
    const cfg = { event: evento, schema: 'public', table: tabela }
    if (filtro) cfg.filter = filtro

    const canal = supabase
      .channel(nome)
      .on('postgres_changes', cfg, (payload) => {
        if (payload.eventType === 'INSERT') cbs.current.onInsert?.(payload.new, payload)
        else if (payload.eventType === 'UPDATE') cbs.current.onUpdate?.(payload.new, payload)
        else if (payload.eventType === 'DELETE') cbs.current.onDelete?.(payload.old, payload)
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [tabela, filtro, evento, ativo])
}
