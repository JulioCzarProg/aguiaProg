export default function Modal({ aberto, titulo, onFechar, children, largura = 'max-w-lg' }) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onFechar}>
      <div className={`bg-white dark:bg-slate-800 rounded-2xl w-full ${largura} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button onClick={onFechar} className="text-2xl text-gray-400 leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
