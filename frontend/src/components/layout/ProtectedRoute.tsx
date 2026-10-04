import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'
import { LoadingMessage } from '@/components/ui/StatusMessage'

interface ProtectedRouteProps {
  roles?: UserRole[]
  loginPath?: string
}

export function ProtectedRoute({ roles, loginPath = '/login/participant' }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingMessage className="py-16 text-center" />
  }

  if (!user) {
    // クエリ(?workshop_id= などの絞り込み)もログイン後の戻り先に含める
    return <Navigate to={loginPath} state={{ from: location.pathname + location.search }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
