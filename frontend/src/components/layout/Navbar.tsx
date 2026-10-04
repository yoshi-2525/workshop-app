import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { canManageWorkshops } from '@/utils/user'

// 未読数のバッジ付きのアイコンリンク(問い合わせ・通知)
function NavIconLink({ to, icon, label, unreadCount }: { to: string; icon: string; label: string; unreadCount: number }) {
  const fullLabel = unreadCount > 0 ? `${label}(未読${unreadCount}件)` : label
  return (
    <Link to={to} aria-label={fullLabel} title={fullLabel} className="relative flex text-fg-secondary hover:text-fg">
      <MaterialIcon name={icon} className="text-[24px]" />
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
  )
}

export function Navbar() {
  const { user } = useAuth()
  const { unreadCount, inquiryUnreadCount } = useNotifications()
  // 管理者も作成できるので、admin も含める
  const isFacilitator = canManageWorkshops(user)

  return (
    // 地の淡い光が透けるよう、ヘッダーは半透明にしてぼかす
    <header className="border-b border-border-muted bg-background/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-brand leading-none text-2xl font-semibold tracking-[0.3em] text-fg">
          TAIWA
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          {/* 狭い画面ではロゴがトップへのリンクを兼ねるので省く */}
          <Link to="/" className="hidden text-fg-secondary hover:text-fg sm:inline">
            場をさがす
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
              <NavIconLink to="/inquiries" icon="chat" label="問い合わせ" unreadCount={inquiryUnreadCount} />
              <NavIconLink to="/notifications" icon="notifications" label="通知" unreadCount={unreadCount} />
              <Link
                to="/settings"
                aria-label={`${user.name}さんの設定`}
                title={`${user.name}さんの設定`}
                className="flex text-fg-secondary hover:text-fg"
              >
                <MaterialIcon name="account_circle" className="text-[28px]" />
              </Link>

            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-md border border-border px-3 py-1.5 text-fg-secondary hover:bg-surface-muted"
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
