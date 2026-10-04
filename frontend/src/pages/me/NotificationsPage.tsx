import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications'
import { extractErrorMessage } from '@/api/client'
import { useNotifications } from '@/context/NotificationContext'
import { useApiResource } from '@/hooks/useApiResource'
import type { Notification } from '@/types'
import { formatDateTime } from '@/utils/format'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'

const typeLabel: Record<Notification['type'], string> = {
  cancellation: '中止',
  reminder: 'リマインダー',
  reservation_canceled: '参加キャンセル',
}

const typeColor: Record<Notification['type'], string> = {
  cancellation: 'bg-red-400/15 text-red-200',
  reminder: 'bg-sky-400/15 text-sky-200',
  reservation_canceled: 'bg-amber-400/15 text-amber-200',
}

export function NotificationsPage() {
  const { unreadCount, refreshUnreadCount } = useNotifications()
  const {
    data,
    loading,
    error: loadError,
    setData: setNotifications,
  } = useApiResource('notifications', listNotifications, '通知の取得に失敗しました')
  const notifications = data ?? []
  const [markError, setMarkError] = useState<string | null>(null)
  const error = loadError ?? markError

  async function handleOpen(notification: Notification) {
    if (notification.is_read) return
    setMarkError(null)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
    )
    try {
      await markNotificationRead(notification.id)
      refreshUnreadCount()
    } catch (err) {
      // 先に既読として表示したので、失敗したら未読に戻す
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: false } : n)),
      )
      setMarkError(extractErrorMessage(err, '既読にできませんでした'))
    }
  }

  async function handleMarkAllRead() {
    // 失敗したときに戻せるよう、未読だったものを覚えておく
    const unreadIds = new Set(notifications.filter((n) => !n.is_read).map((n) => n.id))
    setMarkError(null)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await markAllNotificationsRead()
      refreshUnreadCount()
    } catch (err) {
      setNotifications((prev) => prev.map((n) => (unreadIds.has(n.id) ? { ...n, is_read: false } : n)))
      setMarkError(extractErrorMessage(err, '既読にできませんでした'))
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">通知</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-muted"
          >
            すべて既読にする
          </button>
        )}
      </div>

      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {!loading && notifications.length === 0 && (
        <p className="mt-6 text-fg-muted">通知はまだありません。</p>
      )}

      <ul className="mt-6 space-y-3">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <Link
              to={`/workshops/${notification.workshop_id}`}
              onClick={() => handleOpen(notification)}
              className={`flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-md ${
                notification.is_read
                  ? 'border-border-muted bg-surface'
                  : 'border-border bg-surface-muted'
              }`}
            >
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  notification.is_read ? 'bg-transparent' : 'bg-indigo-500'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[notification.type]}`}
                  >
                    {typeLabel[notification.type]}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {formatDateTime(notification.created_at)}
                  </span>
                </div>
                <p
                  className={`mt-1 whitespace-pre-wrap break-words text-sm ${notification.is_read ? 'text-fg-secondary' : 'font-medium text-fg'}`}
                >
                  {notification.message}
                </p>
                <p className="mt-1 truncate text-xs text-fg-subtle">{notification.workshop_title}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
