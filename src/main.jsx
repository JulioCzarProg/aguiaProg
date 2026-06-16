import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { EventoProvider } from './contexts/EventoContext.jsx'
import './index.css'

// Tema salvo
if (localStorage.getItem('tema') === 'dark') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EventoProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { fontSize: '15px', borderRadius: '12px' },
              duration: 3500
            }}
          />
        </EventoProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
