import { useRef, useState } from 'react'
import { Trash2, Users, User } from 'lucide-react'

// Item da lista de conversas com swipe (arrastar da direita p/ esquerda)
// revelando a lixeira. onApagar só é passado para coordenador/admin.
export default function ConversaItem({ conv, ativo, onAbrir, onApagar, horaCurta, previa }) {
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const moveu = useRef(false)

  function down(e) {
    if (!onApagar) return
    start.current = e.clientX; moveu.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function move(e) {
    if (start.current == null) return
    const d = Math.max(-72, Math.min(0, e.clientX - start.current))
    if (d < -4) moveu.current = true
    setDx(d)
  }
  function up() {
    if (start.current == null) return
    setDx(dx < -40 ? -64 : 0)
    start.current = null
  }

  return (
    <div className="relative border-b dark:border-slate-700/50 overflow-hidden">
      {onApagar && (
        <button onClick={() => onApagar(conv)} aria-label="Apagar conversa"
          className="absolute right-0 top-0 bottom-0 w-16 bg-urgencia text-white grid place-items-center">
          <Trash2 size={20} />
        </button>
      )}
      <button
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
        onClick={() => { if (!moveu.current) { if (dx < 0) setDx(0); else onAbrir(conv.id) } }}
        style={{ transform: `translateX(${dx}px)`, transition: start.current == null ? 'transform .18s' : 'none', touchAction: 'pan-y' }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left bg-white dark:bg-slate-800 ${ativo ? 'bg-blue-50 dark:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
        <div className={`w-10 h-10 rounded-full grid place-items-center text-white shrink-0 ${conv.dm ? 'bg-secundaria' : 'bg-primary'}`}>
          {conv.dm ? <User size={18} /> : <Users size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate flex-1">{conv.nome}</span>
            <span className="text-[11px] text-gray-400">{horaCurta(conv.ultimaEm)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 truncate flex-1">{conv.ultima?.nome_autor ? `${conv.ultima.nome_autor.split(' ')[0]}: ` : ''}{previa(conv.ultima)}</span>
            {conv.naoLidas > 0 && <span className="bg-secundaria text-white text-[11px] rounded-full min-w-[20px] h-5 grid place-items-center px-1">{conv.naoLidas}</span>}
          </div>
        </div>
      </button>
    </div>
  )
}
