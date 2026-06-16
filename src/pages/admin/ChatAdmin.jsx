import Chat from '../voluntario/Chat'

// Chat no painel admin — vê todos os canais (Geral, equipes, Capitães,
// Coordenadores) em tempo real e cria os canais que faltarem.
export default function ChatAdmin() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Chat</h1>
      <p className="text-sm text-gray-500">Você vê todos os grupos em tempo real: Geral, equipes dos capitães, Capitães e Coordenadores.</p>
      <Chat admin />
    </div>
  )
}
