import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const EventoContext = createContext(null)
export const useEvento = () => useContext(EventoContext)

const STORAGE_KEY = 'indicador360_evento'

export function EventoProvider({ children }) {
  const [evento, setEventoState] = useState(null)
  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const carregarEventos = useCallback(async () => {
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .order('created_at', { ascending: false })
    setEventos(data || [])
    return data || []
  }, [])

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      try { setEventoState(JSON.parse(salvo)) } catch { /* ignore */ }
    }
    carregarEventos().finally(() => setCarregando(false))
  }, [carregarEventos])

  const setEvento = useCallback((ev) => {
    setEventoState(ev)
    if (ev) localStorage.setItem(STORAGE_KEY, JSON.stringify(ev))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const valor = { evento, setEvento, eventos, carregarEventos, carregando }
  return <EventoContext.Provider value={valor}>{children}</EventoContext.Provider>
}
