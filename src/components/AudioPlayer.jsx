import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

// Reprodutor inline com waveform via wavesurfer.js
export default function AudioPlayer({ url, cor = '#185FA5' }) {
  const ref = useRef(null)
  const ws = useRef(null)
  const [tocando, setTocando] = useState(false)
  const [dur, setDur] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    ws.current = WaveSurfer.create({
      container: ref.current,
      waveColor: '#cbd5e1',
      progressColor: cor,
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 32,
      url
    })
    ws.current.on('ready', () => setDur(ws.current.getDuration()))
    ws.current.on('finish', () => setTocando(false))
    ws.current.on('play', () => setTocando(true))
    ws.current.on('pause', () => setTocando(false))
    return () => { ws.current?.destroy() }
  }, [url, cor])

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button onClick={() => ws.current?.playPause()}
        className="w-9 h-9 rounded-full bg-primary text-white grid place-items-center shrink-0">
        {tocando ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div ref={ref} className="flex-1" />
      <span className="text-xs text-gray-500 w-9 text-right">{Math.round(dur)}s</span>
    </div>
  )
}
