import { useState } from 'react'
import { ChevronDown, MessageCircle } from 'lucide-react'

const FAQ = [
  { q: 'Como faço a contagem de assistência?',
    a: 'Na aba "Meu Setor", use os botões + e − para contar as pessoas presentes. Quando terminar, toque em "Enviar contagem" e confirme. Faça uma contagem por período (manhã e tarde).' },
  { q: 'Como marco que cheguei no meu setor?',
    a: 'Toque em "Estou aqui" na aba Meu Setor (usa o GPS), ou abra a aba Mapa e toque no seu setor para marcar presença manualmente — ideal para ginásios fechados.' },
  { q: 'O que faço numa emergência?',
    a: 'Toque no botão vermelho "URGÊNCIA". Um alerta é enviado na hora para o canal Geral e todos os capitães e coordenadores recebem.' },
  { q: 'Como envio foto ou áudio no chat?',
    a: 'No chat, toque no ícone 📷 para enviar foto. Para áudio, segure o botão do microfone enquanto fala e solte para enviar.' },
  { q: 'Não recebi meu código de acesso. E agora?',
    a: 'Confira se o número de WhatsApp cadastrado está correto com seu coordenador. Você pode tocar em "Reabrir WhatsApp" na tela de login.' }
]

function Item({ q, a }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="border-b border-gray-100 dark:border-slate-700">
      <button onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-3 text-left font-medium">
        <span>{q}</span>
        <ChevronDown size={18} className={`transition shrink-0 ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && <p className="pb-3 text-sm text-gray-600 dark:text-slate-300">{a}</p>}
    </div>
  )
}

export default function Ajuda() {
  // Configuráveis pelo admin (Configurações) — valores padrão:
  const contato = localStorage.getItem('cfg_contato') || '5538999999999'
  const video = localStorage.getItem('cfg_video') || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const videoId = (video.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="font-bold text-xl">Ajuda</h2>

      <div className="card">
        <div className="font-semibold mb-1">Perguntas frequentes</div>
        {FAQ.map((f, i) => <Item key={i} {...f} />)}
      </div>

      {videoId && (
        <div className="card">
          <div className="font-semibold mb-2">Vídeo tutorial</div>
          <div className="aspect-video rounded-xl overflow-hidden">
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}`}
              title="Tutorial" allowFullScreen />
          </div>
        </div>
      )}

      <a href={`https://wa.me/${contato}`} target="_blank" rel="noreferrer"
        className="btn-secundaria btn-lg w-full">
        <MessageCircle size={20} /> Falar com o responsável
      </a>
    </div>
  )
}
