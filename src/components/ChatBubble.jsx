import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import AudioPlayer from './AudioPlayer'

const corFuncao = {
  admin: 'text-purple-600', coordenador: 'text-secundaria',
  capitao: 'text-primary', voluntario: 'text-gray-500'
}

function hora(d) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatBubble({ msg, proprio }) {
  const [zoom, setZoom] = useState(false)
  const urgente = msg.urgente

  return (
    <div className={`flex ${proprio ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm
        ${urgente ? 'bg-urgencia text-white'
          : proprio ? 'bg-primary text-white'
          : 'bg-white text-gray-800 dark:bg-slate-700 dark:text-slate-100'}`}>
        {!proprio && (
          <div className={`text-xs font-bold ${urgente ? 'text-white' : corFuncao[msg.funcao_autor] || 'text-gray-500'}`}>
            {msg.nome_autor}
            {msg.funcao_autor && msg.funcao_autor !== 'voluntario' && (
              <span className="ml-1 font-normal opacity-80 capitalize">• {msg.funcao_autor}</span>
            )}
          </div>
        )}

        {urgente && <div className="text-xs font-extrabold tracking-wide mb-0.5 flex items-center gap-1"><TriangleAlert size={13} /> URGÊNCIA</div>}

        {msg.tipo === 'texto' && <p className="whitespace-pre-wrap break-words">{msg.texto}</p>}

        {msg.tipo === 'imagem' && (
          <img src={msg.arquivo_url} alt="foto" onClick={() => setZoom(true)}
            className="rounded-lg max-w-full max-h-60 cursor-zoom-in" />
        )}

        {msg.tipo === 'audio' && (
          <div className="py-1"><AudioPlayer url={msg.arquivo_url} cor={proprio || urgente ? '#fff' : '#185FA5'} /></div>
        )}

        <div className={`text-[10px] mt-1 text-right ${proprio || urgente ? 'text-white/70' : 'text-gray-400'}`}>
          {hora(msg.created_at)}
        </div>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/90 grid place-items-center p-4" onClick={() => setZoom(false)}>
          <img src={msg.arquivo_url} alt="foto" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
