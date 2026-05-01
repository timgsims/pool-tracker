import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ProtectedRoute({ children, requireRole }) {
  const { isAuthenticated, isAdmin, isPlayer, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner fullScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireRole === 'admin' && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (requireRole === 'player' && !isPlayer) {
    return <Navigate to="/" replace />
  }

  return children
}
