import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const STORAGE_KEY = 'indicador360_usuario'

// Hierarquia de funções para checagem de nível
const NIVEL = { voluntario: 0, capitao: 1, coordenador: 2, admin: 3 }

// Mantém só os dígitos do telefone (ex.: (38) 99999-9999 -> 3899999999)
export function soDigitos(tel = '') {
  return tel.replace(/\D/g, '')
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      try { setUsuario(JSON.parse(salvo)) } catch { /* ignore */ }
    }
    setCarregando(false)
  }, [])

  const persistir = useCallback((u) => {
    setUsuario(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Passo 1: a Edge Function gera/salva o código e envia pelo WhatsApp (Meta).
  // O código não volta para o navegador (salvo modo de teste do servidor).
  const solicitarCodigo = useCallback(async (telefone) => {
    const digitos = soDigitos(telefone)
    const resp = await fetch(`${SUPA_URL}/functions/v1/enviar-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPA_ANON}`,
        apikey: SUPA_ANON
      },
      body: JSON.stringify({ telefone: digitos })
    }).catch(() => null)

    if (!resp) throw new Error('Sem conexão com o servidor.')
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(data.error || 'Erro ao enviar o código.')
    return { nome: data.nome, devCodigo: data.dev_codigo }
  }, [])

  // Passo 2: valida o código digitado e cria a sessão local
  const verificarCodigo = useCallback(async (telefone, codigo) => {
    const digitos = soDigitos(telefone)
    const { data: u, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefone', digitos)
      .maybeSingle()

    if (error || !u) throw new Error('Cadastro não encontrado.')
    if (!u.codigo_acesso || u.codigo_acesso !== String(codigo).trim())
      throw new Error('Código incorreto.')
    if (u.codigo_expira_em && new Date(u.codigo_expira_em) < new Date())
      throw new Error('Código expirado. Solicite outro.')

    // Limpa o código e marca último acesso
    await supabase.from('usuarios')
      .update({ codigo_acesso: null, codigo_expira_em: null, ultimo_acesso: new Date().toISOString() })
      .eq('id', u.id)

    // Log de acesso
    supabase.from('logs_acesso').insert({
      usuario_id: u.id, acao: 'login', detalhe: 'Login via código WhatsApp'
    }).then(() => {}, () => {})

    const sessao = {
      id: u.id, nome: u.nome, telefone: u.telefone,
      congregacao: u.congregacao, funcao: u.funcao, foto_url: u.foto_url
    }
    persistir(sessao)
    return sessao
  }, [persistir])

  const logout = useCallback(() => {
    persistir(null)
    localStorage.removeItem('indicador360_evento')
  }, [persistir])

  const temNivel = useCallback((minimo) => {
    if (!usuario) return false
    return (NIVEL[usuario.funcao] ?? 0) >= (NIVEL[minimo] ?? 0)
  }, [usuario])

  const valor = {
    usuario, carregando,
    solicitarCodigo, verificarCodigo, logout, temNivel,
    isAdmin: temNivel('admin'),
    isCoordenador: temNivel('coordenador'),
    isCapitao: temNivel('capitao')
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
