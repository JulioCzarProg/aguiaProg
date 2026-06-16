import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadArquivo } from '../supabase'

// Upload de imagem genérico (logo, avatar). onPronto(url)
export default function FotoUpload({ bucket = 'avatares', valor, onPronto, redondo = true, label = 'Enviar foto' }) {
  const ref = useRef(null)
  const [enviando, setEnviando] = useState(false)

  async function escolher(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      const ext = '.' + (file.name.split('.').pop() || 'jpg')
      const url = await uploadArquivo(bucket, file, ext)
      onPronto?.(url)
      toast.success('Imagem enviada!')
    } catch {
      toast.error('Falha no upload.')
    } finally {
      setEnviando(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`${redondo ? 'rounded-full' : 'rounded-xl'} w-16 h-16 bg-gray-100 dark:bg-slate-700 overflow-hidden grid place-items-center shrink-0`}>
        {valor
          ? <img src={valor} alt="" className="w-full h-full object-cover" />
          : <Camera size={24} className="text-gray-400" />}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={escolher} className="hidden" />
      <button type="button" onClick={() => ref.current?.click()} disabled={enviando} className="btn-ghost">
        {enviando ? 'Enviando…' : label}
      </button>
    </div>
  )
}
