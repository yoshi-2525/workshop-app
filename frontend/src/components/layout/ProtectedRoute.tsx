import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  roles?: UserRole[]
  loginPath?: string
}

export function ProtectedRoute({ roles, loginPath = '/login/participant' }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="py-16 text-center text-slate-500">読み込み中...</div>
  }

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
