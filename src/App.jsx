import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Public pages
import Home from './pages/public/Home'
import Matches from './pages/public/Matches'
import Tournaments from './pages/public/Tournaments'
import PlayerProfile from './pages/public/PlayerProfile'
import Stats from './pages/public/Stats'

// Auth
import Login from './pages/auth/Login'
import SetupProfile from './pages/auth/SetupProfile'
import ResetPassword from './pages/auth/ResetPassword'

// Player pages
import EnterResult from './pages/player/EnterResult'

// Admin pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminPlayers from './pages/admin/Players'
import AdminUsers from './pages/admin/Users'
import AdminMatches from './pages/admin/Matches'
import AdminTournaments from './pages/admin/Tournaments'

function ProfileSetupGuard({ children }) {
  const { isAuthenticated, linkedPlayerId, role, loading, recoveryMode } = useAuth()
  const location = useLocation()

  const needsSetup = isAuthenticated && role !== null && !linkedPlayerId && role !== 'admin'
  const onSetupPage = location.pathname === '/setup-profile'
  const onResetPage = location.pathname === '/auth/reset-password'

  if (!loading && recoveryMode && !onResetPage) {
    return <Navigate to="/auth/reset-password" replace />
  }

  if (!loading && needsSetup && !onSetupPage && !onResetPage) {
    return <Navigate to="/setup-profile" replace />
  }

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ProfileSetupGuard>
          <Routes>
            <Route element={<Layout />}>
              {/* Public routes — no auth required */}
              <Route index element={<Home />} />
              <Route path="matches" element={<Matches />} />
              <Route path="tournaments" element={<Tournaments />} />
              <Route path="player/:id" element={<PlayerProfile />} />
              <Route path="stats" element={<Stats />} />
              <Route path="login" element={<Login />} />
              <Route path="setup-profile" element={<SetupProfile />} />
              <Route path="auth/reset-password" element={<ResetPassword />} />

              {/* Player routes — requires player or admin role */}
              <Route
                path="enter-result"
                element={
                  <ProtectedRoute requireRole="player">
                    <EnterResult />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes — requires admin role */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireRole="admin">
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="players" element={<AdminPlayers />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="matches" element={<AdminMatches />} />
                <Route path="tournaments" element={<AdminTournaments />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ProfileSetupGuard>
      </HashRouter>
    </AuthProvider>
  )
}
