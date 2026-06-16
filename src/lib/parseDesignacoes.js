// Parser da planilha "Designações DPTO INDICADORES".
// Cada aba é um turno; dentro dela há grupos (A/B/C/D) com capitão e setores.
// Recebe: [{ turno, rows }] onde rows = matriz (sheet_to_json header:1).
// Retorna: { setores[], pessoas[], designacoes[], turnosDetectados[] }

export const MAPA_TURNOS = {
  'SEXTA MANHÃ': 'Sex Manhã', 'SEXTA TARDE': 'Sex Tarde',
  'SÁBADO MANHÃ': 'Sáb Manhã', 'SÁBADO TARDE': 'Sáb Tarde',
  'DOMINGO MANHÃ': 'Dom Manhã', 'DOMINGO TARDE': 'Dom Tarde'
}

const soDigitos = (t = '') => String(t).replace(/\D/g, '')
const limpar = (t = '') => String(t).replace(/\s+/g, ' ').trim()

// Cor de cada setor conforme o mapa do ginásio (congresso)
export function corPorCodigo(codigo) {
  const c = codigo.toUpperCase()
  if (c === 'C2') return 'vermelho'
  if (['C1', 'C3', 'C4', 'C5'].includes(c)) return 'azul'
  if (['C6', 'C7', 'C8', 'C9'].includes(c)) return 'amarelo'
  if (['D7', 'D8', 'D9', 'D10'].includes(c)) return 'verde'
  if (/^D([1-6])$/.test(c)) return 'amarelo'
  if (c.startsWith('A')) return 'azul'
  if (c.startsWith('B')) return 'roxo'
  return 'cinza' // C10, D11 (anéis superiores)
}

export function parseDesignacoes(abas) {
  const setores = new Map()      // codigo -> {codigo, nome, cor, grupo}
  const pessoas = new Map()      // telefone -> {nome, telefone, congregacao, funcao}
  const designacoes = []         // {telefone, setorCodigo, turno}
  const turnosDetectados = []

  function addPessoa(nome, contato, congregacao, funcao = 'voluntario') {
    const tel = soDigitos(contato)
    nome = limpar(nome)
    if (!nome || tel.length < 10) return null
    const ex = pessoas.get(tel)
    if (!ex) pessoas.set(tel, { nome, telefone: tel, congregacao: limpar(congregacao), funcao })
    else if (funcao === 'capitao') ex.funcao = 'capitao' // promove se for capitão em algum grupo
    return tel
  }

  for (const { turno: nomeAba, rows } of abas) {
    const turno = MAPA_TURNOS[limpar(nomeAba).toUpperCase()] || limpar(nomeAba)
    turnosDetectados.push(turno)

    let grupoAtual = null
    let aguardandoCapitao = false
    let setorAtual = null

    for (const r of rows) {
      const c0 = limpar(r[0]), c1 = limpar(r[1]), c2 = limpar(r[2]), c3 = limpar(r[3]), c4 = limpar(r[4])

      // Cabeçalho de grupo: letra isolada + nome do grupo
      if (/^[A-Z]$/.test(c0) && c1) {
        grupoAtual = { letra: c0, nome: c1 }
        aguardandoCapitao = true
        setorAtual = null
        continue
      }
      // Subcabeçalho "# / SETORES / VOLUNTÁRIO"
      if (c0 === '#' || /^SETORES$/i.test(c1)) { setorAtual = null; continue }

      // Linha do capitão do grupo (logo após o cabeçalho)
      if (aguardandoCapitao && !c0 && c2 && c2.toUpperCase() !== 'CAPITÃO') {
        addPessoa(c2, c4, c3, 'capitao')
        aguardandoCapitao = false
        continue
      }

      // Linha de setor: código tipo A1, C10, D11
      if (/^[A-Z]\d+$/.test(c0)) {
        const codigo = c0
        if (!setores.has(codigo))
          setores.set(codigo, { codigo, nome: limpar(c1), cor: corPorCodigo(codigo), grupo: grupoAtual?.nome || '' })
        setorAtual = codigo
        const tel = addPessoa(c2, c4, c3)
        if (tel) designacoes.push({ telefone: tel, setorCodigo: codigo, turno })
        continue
      }

      // Voluntário adicional do mesmo setor (código vazio, nome preenchido)
      if (!c0 && c2 && setorAtual) {
        const tel = addPessoa(c2, c4, c3)
        if (tel) designacoes.push({ telefone: tel, setorCodigo: setorAtual, turno })
      }
    }
  }

  // Remove designações duplicadas (mesma pessoa/setor/turno)
  const vistos = new Set()
  const desigUnicas = designacoes.filter((d) => {
    const k = `${d.telefone}|${d.setorCodigo}|${d.turno}`
    if (vistos.has(k)) return false
    vistos.add(k); return true
  })

  return {
    setores: [...setores.values()],
    pessoas: [...pessoas.values()],
    designacoes: desigUnicas,
    turnosDetectados: [...new Set(turnosDetectados)]
  }
}
