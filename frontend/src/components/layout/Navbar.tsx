import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { canManageWorkshops } from '@/utils/user'

// ヘッダーは「サイト内の移動」(ロゴの右)と「自分の用事」(右端)の2つのまとまりに分ける。
// 文字で示す項目は、狭い画面ではすべてアイコンに置き換える(どの項目も同じルールにそろえる)
const ICON_CLASS = 'text-[26px]'

// 狭い画面ではアイコン、広い画面(sm)では文字で表示する。
// 読み上げ名は ariaLabel(見えている文字を含む言葉にする)。アイコン部品は自前で表示形式を指定しているので、
// 隠すのは外側の span で行う
function IconOrText({ icon, text }: { icon: string; text: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="flex sm:hidden">
        <MaterialIcon name={icon} className={ICON_CLASS} />
      </span>
      <span aria-hidden="true" className="hidden sm:inline">
        {text}
      </span>
    </>
  )
}

// サイト内の移動のリンク
function SiteNavLink({ to, icon, text, ariaLabel }: { to: string; icon: string; text: string; ariaLabel: string }) {
  return (
    <Link to={to} aria-label={ariaLabel} title={ariaLabel} className="flex items-center text-fg-secondary hover:text-fg">
      <IconOrText icon={icon} text={text} />
    </Link>
  )
}

// 自分の用事のアイコンリンク(問い合わせ・通知・マイページ)。未読数があればバッジを付ける
function UserIconLink({ to, icon, label, unreadCount = 0 }: { to: string; icon: string; label: string; unreadCount?: number }) {
  const fullLabel = unreadCount > 0 ? `${label}(未読${unreadCount}件)` : label
  return (
    <Link to={to} aria-label={fullLabel} title={fullLabel} className="relative flex text-fg-secondary hover:text-fg">
      <MaterialIcon name={icon} className={ICON_CLASS} />
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
      {/* ロゴと文字はスマホ幅だと横に収まらないので、少し広い画面(sm)から大きくする */}
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 text-sm sm:gap-8 sm:py-5 sm:text-base">
        <Link to="/" className="font-brand leading-none text-2xl font-semibold tracking-[0.2em] text-fg sm:text-3xl sm:tracking-[0.3em]">
          TAIWA
        </Link>

        {/* サイト内の移動。対話のルールは参加のたびに思い出してほしいので、どの画面幅でも出す */}
        <nav aria-label="サイト内" className="flex items-center gap-3 sm:gap-6">
          <SiteNavLink to="/" icon="search" text="さがす" ariaLabel="ワークショップをさがす" />
          <SiteNavLink to="/rules" icon="menu_book" text="対話のルール" ariaLabel="対話のルール" />
        </nav>

        {/* 自分の用事 */}
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              {isFacilitator && (
                <Link
                  to="/manage/workshops/new"
                  aria-label="対話を開く(ワークショップを作成する)"
                  title="対話を開く(ワークショップを作成する)"
                  className="flex items-center rounded-md bg-accent p-0.5 text-accent-foreground hover:bg-accent-hover sm:px-4 sm:py-2"
                >
                  <IconOrText icon="add" text="対話を開く" />
                </Link>
              )}
              <UserIconLink to="/inquiries" icon="chat" label="問い合わせ" unreadCount={inquiryUnreadCount} />
              <UserIconLink to="/notifications" icon="notifications" label="通知" unreadCount={unreadCount} />
              <UserIconLink to="/me" icon="account_circle" label={`${user.name}さんのマイページ`} />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-fg-secondary hover:bg-surface-muted sm:px-4 sm:py-2"
              >
                ログイン
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-md bg-accent px-2.5 py-1.5 text-accent-foreground hover:bg-accent-hover sm:px-4 sm:py-2"
              >
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
