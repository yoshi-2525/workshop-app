import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getInquiryUnreadCount } from '@/api/inquiries'
import { getUnreadNotificationCount } from '@/api/notifications'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types'

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

// ログイン中のユーザーの未読数を取得する。未ログインなら 0
function useUnreadCount(user: User | null, fetchCount: () => Promise<number>) {
  const [count, setCount] = useState(0)
  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0)
      return
    }
    try {
      setCount(await fetchCount())
    } catch {
      // 一時的な通信エラーなどでは、前回の値を表示し続ける
    }
  }, [user, fetchCount])
  return [count, setCount, refresh] as const
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount, refreshUnreadCount] = useUnreadCount(user, getUnreadNotificationCount)
  const [inquiryUnreadCount, , refreshInquiryUnreadCount] = useUnreadCount(user, getInquiryUnreadCount)

  // ログイン状態が変わったら取り直し、ログイン中は一定間隔で取り直す
  useEffect(() => {
    function refreshAll() {
      refreshUnreadCount()
      refreshInquiryUnreadCount()
    }
    refreshAll()
    if (!user) return
    const interval = setInterval(refreshAll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, refreshUnreadCount, refreshInquiryUnreadCount])

  // 値が変わったときだけ、通知を使うコンポーネントを再描画させる
  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, setUnreadCount, inquiryUnreadCount, refreshInquiryUnreadCount }),
    [unreadCount, refreshUnreadCount, setUnreadCount, inquiryUnreadCount, refreshInquiryUnreadCount],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
