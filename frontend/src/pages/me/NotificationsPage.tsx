import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications'
import { extractErrorMessage } from '@/api/client'
import { useNotifications } from '@/context/NotificationContext'
import type { Notification } from '@/types'
import { formatDateTime } from '@/utils/format'

const typeLabel: Record<Notification['type'], string> = {
  cancellation: '中止',
  reminder: 'リマインダー',
  reservation_canceled: '参加キャンセル',
}

const typeColor: Record<Notification['type'], string> = {
  cancellation: 'bg-red-100 text-red-700',
  reminder: 'bg-sky-100 text-sky-700',
  reservation_canceled: 'bg-amber-100 text-amber-800',
}

export function NotificationsPage() {
  const { unreadCount, refreshUnreadCount } = useNotifications()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listNotifications()
      .then(setNotifications)
      .catch((err) => setError(extractErrorMessage(err, '通知の取得に失敗しました')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleOpen(notification: Notification) {
    if (notification.is_read) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
    )
    try {
      await markNotificationRead(notification.id)
      refreshUnreadCount()
    } catch (err) {
      setError(extractErrorMessage(err, '既読にできませんでした'))
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await markAllNotificationsRead()
      refreshUnreadCount()
    } catch (err) {
      setError(extractErrorMessage(err, '既読にできませんでした'))
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">通知</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            すべて既読にする
          </button>
        )}
      </div>

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      {!loading && notifications.length === 0 && (
        <p className="mt-6 text-slate-500">通知はまだありません。</p>
      )}

      <ul className="mt-6 space-y-3">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <Link
              to={`/workshops/${notification.workshop_id}`}
              onClick={() => handleOpen(notification)}
              className={`flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-md ${
                notification.is_read
                  ? 'border-border-muted bg-white'
                  : 'border-border bg-slate-50'
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
                  <span className="text-xs text-slate-500">
                    {formatDateTime(notification.created_at)}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm ${notification.is_read ? 'text-slate-600' : 'font-medium text-slate-900'}`}
                >
                  {notification.message}
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">{notification.workshop_title}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
