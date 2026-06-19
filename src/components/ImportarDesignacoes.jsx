import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'
import { parseDesignacoes } from '../lib/parseDesignacoes'
import Modal from './Modal'

// Importa a planilha "Designações DPTO INDICADORES" para o evento atual.
// Lê todas as abas de turno, cria setores, voluntários e designações.
export default function ImportarDesignacoes({ evento, onConcluido }) {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null)
  const [gravando, setGravando] = useState(false)

  function ler(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' })
      const abas = wb.SheetNames.filter((n) => /MANHÃ|TARDE/i.test(n))
        .map((turno) => ({ turno, rows: XLSX.utils.sheet_to_json(wb.Sheets[turno], { header: 1, defval: '' }) }))
      if (!abas.length) return toast.error('Nenhuma aba de turno (MANHÃ/TARDE) encontrada.')
      setParsed(parseDesignacoes(abas))
    }
    reader.readAsBinaryString(file)
  }

  async function gravar() {
    if (!evento) return toast.error('Selecione um evento.')
    setGravando(true)
    try {
      const { setores, pessoas, designacoes, capitaes = [] } = parsed

      // Setores: substitui os do evento
      await supabase.from('setores').delete().eq('evento_id', evento.id)
      const { data: setIns, error: e1 } = await supabase.from('setores').insert(
        setores.map((s) => ({ evento_id: evento.id, codigo: s.codigo, nome: s.nome, cor: s.cor, descricao: s.grupo }))
      ).select('id, codigo')
      if (e1) throw e1
      const setorPorCodigo = Object.fromEntries(setIns.map((s) => [s.codigo, s.id]))

      // Pessoas: upsert por telefone
      const { data: pesIns, error: e2 } = await supabase.from('usuarios').upsert(
        pessoas.map((p) => ({ nome: p.nome, telefone: p.telefone, congregacao: p.congregacao, funcao: p.funcao })),
        { onConflict: 'telefone' }
      ).select('id, telefone')
      if (e2) throw e2
      const usuarioPorTel = Object.fromEntries(pesIns.map((u) => [u.telefone, u.id]))

      // Designações: substitui as do evento
      await supabase.from('designacoes').delete().eq('evento_id', evento.id)
      const linhas = designacoes
        .map((d) => ({ evento_id: evento.id, usuario_id: usuarioPorTel[d.telefone], setor_id: setorPorCodigo[d.setorCodigo], turno: d.turno }))
        .filter((d) => d.usuario_id && d.setor_id)
      for (let i = 0; i < linhas.length; i += 500) {
        const { error } = await supabase.from('designacoes').insert(linhas.slice(i, i + 500))
        if (error) throw error
      }

      // Capitães: designa cada um ao setor representante do seu grupo, no turno
      const repPorGrupo = {}
      for (const s of setores) { if (s.grupo && !repPorGrupo[s.grupo]) repPorGrupo[s.grupo] = setorPorCodigo[s.codigo] }
      const linhasCap = capitaes
        .map((c) => ({ evento_id: evento.id, usuario_id: usuarioPorTel[c.telefone], setor_id: repPorGrupo[c.grupo], turno: c.turno }))
        .filter((d) => d.usuario_id && d.setor_id)
      if (linhasCap.length) await supabase.from('designacoes').insert(linhasCap)

      toast.success(`Importado: ${setIns.length} setores, ${pesIns.length} voluntários, ${linhas.length + linhasCap.length} designações.`)
      setParsed(null)
      onConcluido?.()
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setGravando(false)
    }
  }

  return (
    <>
      <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={16} /> Importar planilha</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => e.target.files[0] && ler(e.target.files[0])} />

      <Modal aberto={!!parsed} titulo="Importar designações" onFechar={() => setParsed(null)}>
        {parsed && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              A planilha será aplicada ao evento <b>{evento?.nome}</b>. Os setores e designações
              atuais deste evento serão <b>substituídos</b>; voluntários são atualizados por telefone.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="card"><div className="text-2xl font-extrabold text-primary">{parsed.setores.length}</div><div className="text-xs text-gray-500">setores</div></div>
              <div className="card"><div className="text-2xl font-extrabold text-secundaria">{parsed.pessoas.length}</div><div className="text-xs text-gray-500">voluntários</div></div>
              <div className="card"><div className="text-2xl font-extrabold">{parsed.designacoes.length}</div><div className="text-xs text-gray-500">designações</div></div>
            </div>
            <p className="text-xs text-gray-400">Turnos: {parsed.turnosDetectados.join(', ')}</p>
            <div className="flex gap-2">
              <button onClick={() => setParsed(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={gravar} disabled={gravando} className="btn-primary flex-1">{gravando ? 'Importando…' : 'Confirmar importação'}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
