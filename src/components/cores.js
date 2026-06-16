// Paleta de cores nomeadas para setores
export const CORES = {
  azul:     { bg: '#185FA5', claro: '#dbeafe', label: 'Azul' },
  verde:    { bg: '#3B6D11', claro: '#dcfce7', label: 'Verde' },
  vermelho: { bg: '#A32D2D', claro: '#fee2e2', label: 'Vermelho' },
  amarelo:  { bg: '#CA8A04', claro: '#fef9c3', label: 'Amarelo' },
  roxo:     { bg: '#6D28D9', claro: '#ede9fe', label: 'Roxo' },
  laranja:  { bg: '#C2410C', claro: '#ffedd5', label: 'Laranja' },
  rosa:     { bg: '#BE185D', claro: '#fce7f3', label: 'Rosa' },
  cinza:    { bg: '#475569', claro: '#e2e8f0', label: 'Cinza' }
}
export const corDe = (nome) => CORES[nome] || CORES.azul
export const LISTA_CORES = Object.keys(CORES)
