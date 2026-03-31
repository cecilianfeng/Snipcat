import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Subscriptions from './pages/Subscriptions'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'
import About from './pages/About'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'

// Wrapper: if logged in, go to dashboard; otherwise show landing page
function HomeRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
