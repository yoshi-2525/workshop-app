import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, login as loginRequest, register as registerRequest } from '@/api/auth'
import { AUTH_EXPIRED_EVENT, tokenStore } from '@/api/client'
import type { RegisterPayload } from '@/api/auth'
import type { User, UserRole } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string, allowedRoles?: UserRole[]) => Promise<User | null>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = tokenStore.get()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const current = await fetchCurrentUser()
      setUser(current)
    } catch {
      // トークンが無効(401)なら apiClient のインターセプターが消す。
      // 通信エラーやサーバーエラーではトークンを残し、次に読み込んだときにログイン状態へ戻れるようにする
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  // API がトークンを無効と判断したら、画面もログアウトした状態にする
  // (ログインが必要なページにいれば ProtectedRoute がログイン画面へ移す)
  useEffect(() => {
    function handleAuthExpired() {
      setUser(null)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  }, [])

  // allowedRoles を指定した場合、役割が合わなければトークンを保存せずに null を返す
  // (ログイン状態には一度もならないので、それまでのログイン状態もそのまま残る)
  const login = useCallback(async (email: string, password: string, allowedRoles?: UserRole[]) => {
    const token = await loginRequest({ email, password })
    const current = await fetchCurrentUser(token)
    if (allowedRoles && !allowedRoles.includes(current.role)) return null
    tokenStore.set(token)
    setUser(current)
    return current
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerRequest(payload)
    const current = await login(payload.email, payload.password)
    // 役割を指定していないので null にはならない
    return current!
  }, [login])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const current = await fetchCurrentUser()
    setUser(current)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
