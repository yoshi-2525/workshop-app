import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, login as loginRequest, register as registerRequest } from '../api/auth'
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_KEY } from '../api/client'
import type { RegisterPayload } from '../api/auth'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const current = await fetchCurrentUser()
      setUser(current)
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
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

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginRequest({ email, password })
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    const current = await fetchCurrentUser()
    setUser(current)
    return current
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerRequest(payload)
    return login(payload.email, payload.password)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
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
