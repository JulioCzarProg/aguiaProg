/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#185FA5',
        secundaria: '#3B6D11',
        urgencia: '#A32D2D'
      },
      minHeight: {
        botao: '48px',
        botaograde: '56px'
      }
    }
  },
  plugins: []
}
