import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

// Máscara (38) 99999-9999
function mascararTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.replace(/(\d{0,2})/, '($1')
  if (d.length <= 7) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export default function Login() {
  const { solicitarCodigo, verificarCodigo } = useAuth()
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState('telefone') // 'telefone' | 'codigo'
  const [telefone, setTelefone] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviarCodigo(e) {
    e?.preventDefault()
    if (telefone.replace(/\D/g, '').length < 10) {
      toast.error('Digite o WhatsApp completo com DDD.')
      return
    }
    setEnviando(true)
    try {
      const { nome, devCodigo } = await solicitarCodigo(telefone)
      setNome(nome)
      setEtapa('codigo')
      if (devCodigo) {
        // Modo de teste do servidor (sem credenciais Meta ainda)
        setCodigo(devCodigo)
        toast.success(`Código (teste): ${devCodigo}`, { duration: 8000 })
      } else {
        toast.success('Código enviado para o seu WhatsApp!')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function entrar(e) {
    e?.preventDefault()
    if (codigo.trim().length !== 6) {
      toast.error('O código tem 6 dígitos.')
      return
    }
    setEnviando(true)
    try {
      await verificarCodigo(telefone, codigo)
      toast.success('Bem-vindo!')
      navigate('/eventos', { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10
                    bg-gradient-to-b from-primary to-[#0d4178]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-white">
          <img src="/logo.svg" alt="Indicador360" className="w-24 drop-shadow-lg" />
          <h1 className="text-3xl font-bold mt-3">Indicador360</h1>
          <p className="text-white/80 text-lg mt-1">Voluntários • Congressos e Assembleias</p>
        </div>

        <div className="card !p-6">
          {etapa === 'telefone' && (
            <form onSubmit={enviarCodigo} className="space-y-5">
              <div>
                <label className="label text-base">Seu WhatsApp</label>
                <input
                  className="input !min-h-[56px] text-xl text-center tracking-wide"
                  inputMode="numeric"
                  placeholder="(38) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  autoFocus
                />
              </div>
              <button type="submit" disabled={enviando}
                className="btn-primary btn-lg w-full text-xl">
                {enviando ? 'Gerando…' : 'Entrar'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Você receberá um código de 6 dígitos no WhatsApp.
              </p>
            </form>
          )}

          {etapa === 'codigo' && (
            <form onSubmit={entrar} className="space-y-5">
              <p className="text-center text-gray-700 dark:text-slate-200">
                Olá, <strong>{nome}</strong>! Digite o código enviado para
                <br /><span className="font-semibold">{telefone}</span>
              </p>
              <input
                className="input !min-h-[56px] text-3xl text-center tracking-[0.5em] font-bold"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
              <button type="submit" disabled={enviando}
                className="btn-primary btn-lg w-full text-xl">
                {enviando ? 'Validando…' : 'Confirmar código'}
              </button>
              <div className="flex flex-col gap-2 text-center text-sm">
                <button type="button" onClick={enviarCodigo} disabled={enviando}
                  className="text-primary font-semibold">
                  Não recebeu? Reenviar código
                </button>
                <button type="button" onClick={() => { setEtapa('telefone'); setCodigo('') }}
                  className="text-gray-500 underline">
                  Trocar número
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-white/70 text-sm mt-6">
          Cadastro feito pelo coordenador. Sem senha.
        </p>
      </div>
    </div>
  )
}
