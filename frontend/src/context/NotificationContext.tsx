import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getInquiryUnreadCount } from '@/api/inquiries'
import { getUnreadNotificationCount } from '@/api/notifications'
import { useAuth } from '@/context/AuthContext'

interface NotificationContextValue {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  setUnreadCount: (count: number) => void
  // 問い合わせの未読メッセージ数。通知と同じ間隔で取得する
  inquiryUnreadCount: number
  refreshInquiryUnreadCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

const POLL_INTERVAL_MS = 60_000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [inquiryUnreadCount, setInquiryUnreadCount] = useState(0)

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

  const refreshInquiryUnreadCount = useCallback(async () => {
    if (!user) {
      setInquiryUnreadCount(0)
      return
    }
    try {
      setInquiryUnreadCount(await getInquiryUnreadCount())
    } catch {
      // transient network error: keep the previous count
    }
  }, [user])

  useEffect(() => {
    refreshUnreadCount()
    refreshInquiryUnreadCount()
    if (!user) return
    const interval = setInterval(() => {
      refreshUnreadCount()
      refreshInquiryUnreadCount()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, refreshUnreadCount, refreshInquiryUnreadCount])

  // 値が変わったときだけ、通知を使うコンポーネントを再描画させる
  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, setUnreadCount, inquiryUnreadCount, refreshInquiryUnreadCount }),
    [unreadCount, refreshUnreadCount, inquiryUnreadCount, refreshInquiryUnreadCount],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
