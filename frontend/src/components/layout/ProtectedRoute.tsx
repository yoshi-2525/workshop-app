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
    return <div className="py-16 text-center text-fg-muted">読み込み中...</div>
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
