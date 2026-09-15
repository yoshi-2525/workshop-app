import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getUnreadNotificationCount } from '../api/notifications'
import { useAuth } from './AuthContext'

interface NotificationContextValue {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  setUnreadCount: (count: number) => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

const POLL_INTERVAL_MS = 60_000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      setUnreadCount(await getUnreadNotificationCount())
    } catch {
      // transient network error: keep the previous count
    }
  }, [user])

  useEffect(() => {
    refreshUnreadCount()
    if (!user) return
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, setUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
