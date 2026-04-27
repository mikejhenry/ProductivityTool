import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AppPage from './pages/AppPage'
import TodayPage from './pages/TodayPage'
import NotesPage from './pages/NotesPage'
import ShoppingPage from './pages/ShoppingPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
      <Route path="/app/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
      <Route path="/app/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
      <Route path="/app/shopping" element={<ProtectedRoute><ShoppingPage /></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
