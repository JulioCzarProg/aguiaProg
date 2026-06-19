import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const STORAGE_KEY = 'indicador360_usuario'
const NIVEL = { voluntario: 0, capitao: 1, coordenador: 2, admin: 3 }

// Mantém só os dígitos do telefone (ex.: (38) 99999-9999 -> 3899999999)
export function soDigitos(tel = '') { return tel.replace(/\D/g, '') }
const primeiroNome = (n = '') => n.trim().split(/\s+/)[0]
const pub = (u) => ({ id: u.id, nome: u.nome, telefone: u.telefone, congregacao: u.congregacao, funcao: u.funcao, foto_url: u.foto_url })

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) { try { setUsuario(JSON.parse(s)) } catch { /* ignore */ } }
    setCarregando(false)
  }, [])

  const persistir = useCallback((u) => {
    setUsuario(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  // gera 5 opções (primeiro nome OU congregação) para o desafio do capitão
  async function desafioCapitao(u) {
    const porNome = Math.random() < 0.5
    const campo = porNome ? 'nome' : 'congregacao'
    const correta = porNome ? primeiroNome(u.nome) : (u.congregacao || '')
    const { data } = await supabase.from('usuarios').select(campo).neq('id', u.id).limit(300)
    let pool = [...new Set((data || []).map((x) => porNome ? primeiroNome(x[campo] || '') : (x[campo] || '')).filter((v) => v && v !== correta))]
    pool = pool.sort(() => Math.random() - 0.5).slice(0, 4)
    const opcoes = [...pool, correta].sort(() => Math.random() - 0.5)
    return { campo: porNome ? 'nome' : 'congregação', correta, opcoes }
  }

  // Passo 1: busca o usuário e decide o desafio de acesso conforme a função
  const iniciarLogin = useCallback(async (telefone) => {
    const digitos = soDigitos(telefone)
    const { data: u, error } = await supabase.from('usuarios')
      .select('id, nome, telefone, congregacao, funcao, foto_url, ativo, codigo_acesso')
      .eq('telefone', digitos).maybeSingle()
    if (error) throw new Error('Erro ao consultar cadastro.')
    if (!u) throw new Error('Telefone não cadastrado. Procure o coordenador.')
    if (!u.ativo) throw new Error('Cadastro inativo. Procure o coordenador.')

    const temSenha = !!(u.codigo_acesso && String(u.codigo_acesso).trim())
    const nivel = NIVEL[u.funcao] ?? 0
    if (temSenha) return { tipo: 'senha', usuario: pub(u) }                 // senha ativada para este usuário
    if (nivel >= NIVEL.coordenador) return { tipo: 'direto', usuario: pub(u) } // admin/coord sem senha: bootstrap por telefone
    if (u.funcao === 'capitao') return { tipo: 'desafio', usuario: pub(u), ...(await desafioCapitao(u)) }
    return { tipo: 'direto', usuario: pub(u) }                              // voluntário: só telefone
  }, [])

  const verificarSenha = useCallback(async (telefone, senha) => {
    const { data: u } = await supabase.from('usuarios').select('codigo_acesso').eq('telefone', soDigitos(telefone)).maybeSingle()
    return !!u && String(u.codigo_acesso || '').trim() === String(senha).trim()
  }, [])

  // cria a sessão local
  const entrar = useCallback((u) => {
    const sessao = pub(u)
    supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', u.id).then(() => {}, () => {})
    supabase.from('logs_acesso').insert({ usuario_id: u.id, acao: 'login', detalhe: 'Login por telefone' }).then(() => {}, () => {})
    persistir(sessao)
    return sessao
  }, [persistir])

  const logout = useCallback(() => { persistir(null); localStorage.removeItem('indicador360_evento') }, [persistir])
  const temNivel = useCallback((m) => { if (!usuario) return false; return (NIVEL[usuario.funcao] ?? 0) >= (NIVEL[m] ?? 0) }, [usuario])

  const valor = {
    usuario, carregando, iniciarLogin, verificarSenha, entrar, logout, temNivel,
    isAdmin: temNivel('admin'), isCoordenador: temNivel('coordenador'), isCapitao: temNivel('capitao')
  }
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
