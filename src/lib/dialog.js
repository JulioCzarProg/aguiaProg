// Diálogos do sistema (substituem window.confirm/prompt do navegador).
// Use: import { confirmar, pedir } from '../lib/dialog'
//   if (!(await confirmar('Apagar?'))) return
//   const nome = await pedir('Nome:', '')
let solicitar = null
export function registrarDialog(fn) { solicitar = fn }

export function confirmar(mensagem, opts = {}) {
  if (!solicitar) return Promise.resolve(window.confirm(mensagem))
  return solicitar({ tipo: 'confirm', mensagem, ...opts })
}
export function pedir(mensagem, valor = '', opts = {}) {
  if (!solicitar) return Promise.resolve(window.prompt(mensagem, valor))
  return solicitar({ tipo: 'prompt', mensagem, valor, ...opts })
}
