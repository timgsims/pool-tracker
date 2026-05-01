import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Public pages
import Home from './pages/public/Home'
import Matches from './pages/public/Matches'
import Tournaments from './pages/public/Tournaments'
import PlayerProfile from './pages/public/PlayerProfile'

// Auth
import Login from './pages/auth/Login'
import SetupProfile from './pages/auth/SetupProfile'

// Player pages
import EnterResult from './pages/player/EnterResult'

// Admin pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminPlayers from './pages/admin/Players'
import AdminUsers from './pages/admin/Users'
import AdminMatches from './pages/admin/Matches'
import AdminTournaments from './pages/admin/Tournaments'

// Redirects non-admin users to profile setup if they haven't set a display name yet
function ProfileSetupGuard({ children }) {
  const { isAuthenticated, linkedPlayerId, role, loading } = useAuth()
  const location = useLocation()

  const needsSetup = isAuthenticated && role !== null && !linkedPlayerId && role !== 'admin'
  const onSetupPage = location.pathname === '/setup-profile'

  if (!loading && needsSetup && !onSetupPage) {
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
              <Route path="login" element={<Login />} />
              <Route path="setup-profile" element={<SetupProfile />} />

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
