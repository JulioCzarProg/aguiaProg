import { useEffect, useState } from 'react'
import { registrarDialog } from '../lib/dialog'

// Modal global de confirmação/entrada (registrado uma vez no app).
export default function Dialogs() {
  const [d, setD] = useState(null)
  const [val, setVal] = useState('')

  useEffect(() => {
    registrarDialog((opts) => new Promise((resolve) => { setVal(opts.valor || ''); setD({ ...opts, resolve }) }))
  }, [])

  if (!d) return null
  const cancelar = () => { d.resolve(d.tipo === 'confirm' ? false : null); setD(null) }
  const ok = () => { d.resolve(d.tipo === 'confirm' ? true : val); setD(null) }

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 grid place-items-center p-4" onClick={cancelar}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4">
          <h3 className="font-bold text-lg">{d.titulo || (d.tipo === 'prompt' ? 'Informe' : 'Confirmar')}</h3>
          <p className="text-gray-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{d.mensagem}</p>
          {d.tipo === 'prompt' && (
            <input className="input mt-3" autoFocus value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ok() }} />
          )}
        </div>
        <div className="flex gap-2 p-4">
          <button onClick={cancelar} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={ok} className={`flex-1 ${d.perigo ? 'btn-urgencia' : 'btn-primary'}`}>{d.confirmLabel || 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}
