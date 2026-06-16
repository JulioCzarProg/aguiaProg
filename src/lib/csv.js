// Exporta um array de objetos para CSV e dispara o download
export function exportarCSV(nomeArquivo, linhas) {
  if (!linhas?.length) return
  const colunas = Object.keys(linhas[0])
  const escapar = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    colunas.join(';'),
    ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(';'))
  ].join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Baixa qualquer objeto como JSON
export function baixarJSON(nomeArquivo, dados) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.json') ? nomeArquivo : `${nomeArquivo}.json`
  a.click()
  URL.revokeObjectURL(url)
}
