import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

export function Navbar() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          Workshop App
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-slate-600 hover:text-slate-900">
            ワークショップ一覧
          </Link>
          {user && (
            <Link to="/favorites" className="text-slate-600 hover:text-slate-900">
              お気に入り
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/notifications"
                aria-label="通知"
                title="通知"
                className="relative text-slate-600 hover:text-slate-900"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
                aria-label="設定"
                title="設定"
                className="text-slate-600 hover:text-slate-900"
              >
                {user.name}さん
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                ログイン
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
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
