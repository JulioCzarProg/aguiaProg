import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useEvento } from './contexts/EventoContext'
import AvisoListener from './components/AvisoListener'
import HorarioWatcher from './components/HorarioWatcher'

import Login from './pages/Login'
import SelecaoEvento from './pages/SelecaoEvento'

import VoluntarioLayout from './pages/voluntario/VoluntarioLayout'
import MeuSetor from './pages/voluntario/MeuSetor'
import Chat from './pages/voluntario/Chat'
import Ajuda from './pages/voluntario/Ajuda'
import MapaVoluntario from './pages/voluntario/MapaVoluntario'

import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Usuarios from './pages/admin/Usuarios'
import Setores from './pages/admin/Setores'
import Programacao from './pages/admin/Programacao'
import Mapa from './pages/admin/Mapa'
import Reunioes from './pages/admin/Reunioes'
import Contagens from './pages/admin/Contagens'
import ChatAdmin from './pages/admin/ChatAdmin'
import Avisos from './pages/admin/Avisos'
import Logs from './pages/admin/Logs'
import Configuracoes from './pages/admin/Configuracoes'

function Carregando() {
  return (
    <div className="min-h-screen grid place-items-center text-gray-500">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo.svg" className="w-16 animate-pulse" alt="Indicador360" />
        <span>Carregando…</span>
      </div>
    </div>
  )
}

// Exige login. Se exigeAdmin, também exige nível coordenador+.
function Protegido({ children, exigeAdmin = false }) {
  const { usuario, carregando, temNivel } = useAuth()
  const location = useLocation()
  if (carregando) return <Carregando />
  if (!usuario) return <Navigate to="/login" state={{ from: location }} replace />
  if (exigeAdmin && !temNivel('coordenador'))
    return <Navigate to="/app" replace />
  return children
}

// Garante que um evento esteja selecionado
function ComEvento({ children }) {
  const { evento, carregando } = useEvento()
  if (carregando) return <Carregando />
  if (!evento) return <Navigate to="/eventos" replace />
  return children
}

export default function App() {
  const { usuario } = useAuth()

  return (
    <>
    {usuario && <AvisoListener />}
    {usuario && <HorarioWatcher />}
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/eventos" replace /> : <Login />} />

      <Route path="/eventos" element={
        <Protegido><SelecaoEvento /></Protegido>
      } />

      {/* Área do voluntário */}
      <Route path="/app" element={
        <Protegido><ComEvento><VoluntarioLayout /></ComEvento></Protegido>
      }>
        <Route index element={<MeuSetor />} />
        <Route path="mapa" element={<MapaVoluntario />} />
        <Route path="chat" element={<Chat />} />
        <Route path="ajuda" element={<Ajuda />} />
      </Route>

      {/* Área admin */}
      <Route path="/admin" element={
        <Protegido exigeAdmin><ComEvento><AdminLayout /></ComEvento></Protegido>
      }>
        <Route index element={<Dashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="setores" element={<Setores />} />
        <Route path="programacao" element={<Programacao />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="reunioes" element={<Reunioes />} />
        <Route path="contagens" element={<Contagens />} />
        <Route path="chat" element={<ChatAdmin />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="logs" element={<Logs />} />
        <Route path="config" element={<Configuracoes />} />
      </Route>

      <Route path="*" element={<Navigate to={usuario ? '/eventos' : '/login'} replace />} />
    </Routes>
    </>
  )
}
