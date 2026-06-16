// Card de voluntário usado no drag & drop da Programação.
// estado: 'disponivel' | 'designado' | 'duplo'
const cores = {
  disponivel: 'bg-gray-100 border-gray-200 dark:bg-slate-700 dark:border-slate-600',
  designado: 'bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700',
  duplo: 'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
}

export default function DragVoluntario({ voluntario, estado = 'disponivel', onContextMenu, dragging }) {
  return (
    <div onContextMenu={onContextMenu}
      className={`rounded-lg border px-3 py-2 text-sm select-none flex items-center gap-2
        ${cores[estado]} ${dragging ? 'shadow-lg ring-2 ring-primary' : ''}`}>
      <span className={`w-2 h-2 rounded-full shrink-0
        ${estado === 'designado' ? 'bg-green-500' : estado === 'duplo' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      <div className="min-w-0">
        <div className="font-semibold truncate">{voluntario.nome}</div>
        {voluntario.congregacao && (
          <div className="text-xs text-gray-500 truncate">{voluntario.congregacao}</div>
        )}
      </div>
    </div>
  )
}
