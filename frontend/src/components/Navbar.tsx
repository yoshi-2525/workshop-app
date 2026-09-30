import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { MaterialIcon } from './MaterialIcon'

export function Navbar() {
  const { user } = useAuth()
  const { unreadCount } = useNotifications()
  // 管理者も作成できるので、admin も含める
  const isFacilitator = user?.role === 'admin' || user?.role === 'facilitator'
  const notificationLabel = unreadCount > 0 ? `通知(未読${unreadCount}件)` : '通知'

  return (
    <header className="border-b border-border-muted bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          Workshop App
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-slate-600 hover:text-slate-900">
            ワークショップ一覧
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              {isFacilitator && (
                <Link
                  to="/manage/workshops/new"
                  className="rounded-md bg-accent px-3 py-1.5 text-accent-foreground hover:bg-accent-hover"
                >
                  ワークショップの開催
                </Link>
              )}
              <Link
                to="/notifications"
                aria-label={notificationLabel}
                title={notificationLabel}
                className="relative flex text-slate-600 hover:text-slate-900"
              >
                <MaterialIcon name="notifications" className="text-[24px]" />
                {/* 未読数は aria-label で伝えるので、バッジ自体は読み上げない */}
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
                aria-label={`${user.name}さんの設定`}
                title={`${user.name}さんの設定`}
                className="flex text-slate-600 hover:text-slate-900"
              >
                <MaterialIcon name="account_circle" className="text-[28px]" />
              </Link>

            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                ログイン
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-accent px-3 py-1.5 text-accent-foreground hover:bg-accent-hover"
              >
                新規登録
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
