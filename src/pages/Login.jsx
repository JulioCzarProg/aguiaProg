import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

function mascararTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.replace(/(\d{0,2})/, '($1')
  if (d.length <= 7) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export default function Login() {
  const { iniciarLogin, verificarSenha, entrar } = useAuth()
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState('telefone') // telefone | senha | desafio
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendente, setPendente] = useState(null) // { usuario, campo, correta, opcoes }

  async function continuar(e) {
    e?.preventDefault()
    if (telefone.replace(/\D/g, '').length < 10) return toast.error('Digite o WhatsApp completo com DDD.')
    setEnviando(true)
    try {
      const r = await iniciarLogin(telefone)
      setPendente(r)
      if (r.tipo === 'direto') { entrar(r.usuario); toast.success(`Bem-vindo, ${r.usuario.nome.split(' ')[0]}!`); navigate('/eventos', { replace: true }) }
      else if (r.tipo === 'senha') setEtapa('senha')
      else setEtapa('desafio')
    } catch (err) { toast.error(err.message) } finally { setEnviando(false) }
  }

  async function entrarSenha(e) {
    e?.preventDefault()
    setEnviando(true)
    try {
      const ok = await verificarSenha(telefone, senha)
      if (!ok) return toast.error('Senha incorreta.')
      entrar(pendente.usuario); navigate('/eventos', { replace: true })
    } finally { setEnviando(false) }
  }

  function escolher(opcao) {
    if (opcao === pendente.correta) { entrar(pendente.usuario); navigate('/eventos', { replace: true }) }
    else toast.error('Opção incorreta. Tente novamente.')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-primary to-[#0d4178]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-white">
          <img src="/logo.svg" alt="Indicador360" className="w-24 drop-shadow-lg" />
          <h1 className="text-3xl font-bold mt-3">Indicador360</h1>
          <p className="text-white/80 text-lg mt-1">Voluntários • Congressos e Assembleias</p>
        </div>

        <div className="card !p-6">
          {etapa === 'telefone' && (
            <form onSubmit={continuar} className="space-y-5">
              <div>
                <label className="label text-base">Seu WhatsApp</label>
                <input className="input !min-h-[56px] text-xl text-center tracking-wide" inputMode="numeric"
                  placeholder="(38) 99999-9999" value={telefone} autoFocus
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))} />
              </div>
              <button type="submit" disabled={enviando} className="btn-primary btn-lg w-full text-xl">
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
              <p className="text-center text-sm text-gray-500">Use o número cadastrado pelo coordenador.</p>
            </form>
          )}

          {etapa === 'senha' && (
            <form onSubmit={entrarSenha} className="space-y-5">
              <p className="text-center text-gray-700 dark:text-slate-200">
                Olá, <strong>{pendente?.usuario?.nome?.split(' ')[0]}</strong>! Digite sua senha.
              </p>
              <input type="password" className="input !min-h-[56px] text-xl text-center" placeholder="Senha"
                value={senha} autoFocus onChange={(e) => setSenha(e.target.value)} />
              <button type="submit" disabled={enviando} className="btn-primary btn-lg w-full text-xl">
                {enviando ? 'Verificando…' : 'Entrar'}
              </button>
              <button type="button" onClick={() => { setEtapa('telefone'); setSenha('') }} className="text-gray-500 underline w-full text-sm">Trocar número</button>
            </form>
          )}

          {etapa === 'desafio' && pendente && (
            <div className="space-y-4">
              <p className="text-center text-gray-700 dark:text-slate-200">
                Olá, <strong>{pendente.usuario.nome.split(' ')[0]}</strong>! Para confirmar, escolha
                {pendente.campo === 'nome' ? ' o seu primeiro nome:' : ' a sua congregação:'}
              </p>
              <div className="grid gap-2">
                {pendente.opcoes.map((op, i) => (
                  <button key={i} onClick={() => escolher(op)} className="btn-ghost btn-lg w-full text-lg">{op || '—'}</button>
                ))}
              </div>
              <button type="button" onClick={() => { setEtapa('telefone'); setPendente(null) }} className="text-gray-500 underline w-full text-sm">Trocar número</button>
            </div>
          )}
        </div>

        <p className="text-center text-white/70 text-sm mt-6">Sem senha para voluntários. Cadastro feito pelo coordenador.</p>
      </div>
    </div>
  )
}
