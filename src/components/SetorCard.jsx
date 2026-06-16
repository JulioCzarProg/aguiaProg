import { corDe } from './cores'

// Card de setor reutilizável (lista admin e programação)
export default function SetorCard({ setor, designados = 0, children, onClick, compacto }) {
  const c = corDe(setor.cor)
  return (
    <div onClick={onClick}
      className={`rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
      <div className="px-3 py-2 flex items-center gap-2 text-white" style={{ background: c.bg }}>
        <span className="font-extrabold text-lg">{setor.codigo}</span>
        <span className="font-medium truncate flex-1">{setor.nome}</span>
        {!compacto && setor.capacidade != null && (
          <span className="text-xs bg-white/25 rounded-full px-2 py-0.5">
            {designados}/{setor.capacidade}
          </span>
        )}
      </div>
      {children && <div className="p-2">{children}</div>}
    </div>
  )
}
