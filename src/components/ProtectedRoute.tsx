import { Navigate, useLocation } from 'react-router-dom'
import { auth } from '../api/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  
  if (!auth.isAuthenticated()) {
    // Preserve intended destination in location state for redirect after login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}


