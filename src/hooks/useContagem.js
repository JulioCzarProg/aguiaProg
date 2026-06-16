import { useCallback, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useEvento } from '../contexts/EventoContext'

// Período e dia derivam do TURNO designado (não da hora atual)
export function periodoDoTurno(turno = '') { return /tarde/i.test(turno) ? 'tarde' : 'manha' }
export function diaDoTurno(turno = '') {
  if (/sex/i.test(turno)) return 'Sexta'
  if (/s[áa]b/i.test(turno)) return 'Sábado'
  if (/dom/i.test(turno)) return 'Domingo'
  return ''
}

export function useContagem(setorId) {
  const { usuario } = useAuth()
  const { evento } = useEvento()
  const [quantidade, setQuantidade] = useState(0)
  const [enviando, setEnviando] = useState(false)

  const incrementar = useCallback((n = 1) => setQuantidade((q) => Math.max(0, q + n)), [])

  // turno vem da designação selecionada
  const enviar = useCallback(async (turno, origem = 'voluntario') => {
    setEnviando(true)
    try {
      const { error } = await supabase.from('contagens').insert({
        evento_id: evento?.id, setor_id: setorId, usuario_id: usuario.id,
        turno: turno || null, periodo: periodoDoTurno(turno), dia: diaDoTurno(turno),
        quantidade, status: 'pendente', origem, nome_contador: usuario.nome
      })
      if (error) throw error
      return true
    } finally {
      setEnviando(false)
    }
  }, [evento, setorId, usuario, quantidade])

  return { quantidade, setQuantidade, incrementar, enviar, enviando }
}
