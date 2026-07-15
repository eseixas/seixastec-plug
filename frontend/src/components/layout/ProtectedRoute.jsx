import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import Spinner from '../ui/Spinner.jsx'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
