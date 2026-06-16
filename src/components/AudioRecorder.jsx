import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

// Botão "segurar para gravar" usando MediaRecorder API.
// onGravado(blob, duracaoSegundos)
export default function AudioRecorder({ onGravado }) {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const rec = useRef(null)
  const chunks = useRef([])
  const inicio = useRef(0)
  const timer = useRef(null)

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks.current = []
      rec.current = new MediaRecorder(stream)
      rec.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const dur = Math.max(1, Math.round((Date.now() - inicio.current) / 1000))
        stream.getTracks().forEach((t) => t.stop())
        if (dur >= 1) onGravado?.(blob, dur)
      }
      inicio.current = Date.now()
      rec.current.start()
      setGravando(true); setSegundos(0)
      timer.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    } catch {
      toast.error('Não foi possível acessar o microfone.')
    }
  }

  function parar() {
    if (rec.current && gravando) {
      rec.current.stop()
      setGravando(false)
      clearInterval(timer.current)
    }
  }

  return (
    <button
      onMouseDown={iniciar} onMouseUp={parar} onMouseLeave={parar}
      onTouchStart={(e) => { e.preventDefault(); iniciar() }}
      onTouchEnd={(e) => { e.preventDefault(); parar() }}
      className={`btn w-12 h-12 rounded-full shrink-0 text-white select-none
        ${gravando ? 'bg-urgencia animate-pulse scale-110' : 'bg-primary'}`}
      title="Segure para gravar">
      {gravando ? (
        <span className="text-xs font-bold">{segundos}s</span>
      ) : (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </button>
  )
}
