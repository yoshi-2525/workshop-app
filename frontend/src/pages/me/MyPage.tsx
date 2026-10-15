import { useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HELP_DOCUMENTS } from '@/pages/help/helpDocuments'
import type { UserRole } from '@/types'
import { canManageWorkshops } from '@/utils/user'
import { ADMIN_PAYOUT_REQUESTS_PATH, PAYOUT_SETTINGS_PATH } from '@/utils/payment'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { THIRDLY_BUTTON_CLASS } from '@/components/ui/styles'
import { useBackState } from '@/hooks/useBackState'

interface MenuLink {
  to: string
  title: string
  description: string
}

const ROLE_LABEL: Record<UserRole, string> = {
  participant: '参加者',
  facilitator: '主催者',
  admin: '運営',
}

// 見出し付きのメニューのまとまり。暗い面のカード1枚に、項目を区切り線で1行ずつ並べる
// (ワークショップ管理・予約状況・フォロー一覧と同じ面)。
// compact は名前だけの小さめの行にする(ヘルプ・規約など、説明を毎回読む必要がないもの)
function MenuSection({ heading, links, compact = false }: { heading: string; links: MenuLink[]; compact?: boolean }) {
  const headingId = useId()
  const backState = useBackState('マイページ')
  return (
    <section aria-labelledby={headingId} className="mt-9">
      <h2 id={headingId} className="text-base font-semibold text-fg-secondary">
        {heading}
      </h2>
      <ul className="mt-3 divide-y divide-border-muted overflow-hidden rounded-lg bg-surface-muted shadow-card">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              state={backState}
              className={`flex items-center gap-4 px-5 transition-colors hover:bg-surface-strong/40 focus-visible:bg-surface-strong/40 focus-ring focus:outline-hidden ${
                compact ? 'py-3.5' : 'py-4'
              }`}
            >
              {compact ? (
                <span className="min-w-0 flex-1 text-fg-secondary">{link.title}</span>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{link.title}</p>
                  <p className="mt-1 text-sm text-fg-muted">{link.description}</p>
                </div>
              )}
              <MaterialIcon name="chevron_right" className="shrink-0 text-[24px] text-fg-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// マイページ(/me)。自分の予約・お気に入り・問い合わせ・アカウントなど、ログイン中の人向けのメニューを性質ごとにまとめる
export function MyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const backState = useBackState('マイページ')
  if (!user) return null

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isFacilitator = canManageWorkshops(user)

  const reservationLinks: MenuLink[] = [
    {
      to: '/reservations',
      title: '参加予定のワークショップ',
      description: 'これから参加する予定のワークショップを確認できます。',
    },
    {
      to: '/reservations/history',
      title: '予約・参加履歴',
      description: '過去に参加したワークショップや、キャンセル・中止になったものも含めた予約の履歴を見られます。',
    },
    {
      to: '/favorites',
      title: 'お気に入り',
      description: 'お気に入りに登録したワークショップを確認できます。',
    },
    {
      to: '/following',
      title: 'フォロー中の主催者のワークショップ',
      description: 'フォローしている主催者と、その開催予定のワークショップを確認できます。',
    },
  ]

  const facilitatorLinks: MenuLink[] = [
    {
      to: '/manage',
      title: 'ワークショップの管理',
      description: '自分のワークショップの作成・編集・削除、予約状況の確認を行います。',
    },
    {
      to: PAYOUT_SETTINGS_PATH,
      title: '売上と振込',
      description: 'オンライン決済の売上の確認、振込先の口座の登録、振込の申請を行います。',
    },
    // 振込の処理は運営だけが行う
    ...(user.role === 'admin'
      ? [
          {
            to: ADMIN_PAYOUT_REQUESTS_PATH,
            title: '振込の申請(運営)',
            description: '主催者からの振込の申請を確認し、振り込んだ結果を記録します。',
          },
        ]
      : []),
  ]

  const inquiryLinks: MenuLink[] = [
    {
      to: '/inquiries',
      title: '問い合わせ',
      description: isFacilitator
        ? '主催者への問い合わせや、自分のワークショップに届いた問い合わせのやり取りを確認できます。'
        : '主催者への問い合わせのやり取りを確認できます。',
    },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-fg">マイページ</h1>

      {/* 自分のアカウント。プロフィール編集はここから行う(「アカウント」の段は1項目だけだったので、ここにまとめた) */}
      <section
        aria-label="アカウント"
        className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-4 rounded-lg bg-surface-muted px-5 py-5 shadow-card sm:px-6"
      >
        <Avatar url={user.avatar_url} name={user.name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-[1_1_12rem]">
          <p className="break-all text-lg font-semibold text-fg">{user.name}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs text-fg-secondary">{ROLE_LABEL[user.role]}</span>
            <span className="break-all">{user.email}</span>
          </p>
        </div>
        <Link to="/me/profile" state={backState} className={THIRDLY_BUTTON_CLASS}>
          プロフィール編集
        </Link>
      </section>

      {/* ワークショップを開けるのは主催者と運営だけ。主催者はワークショップの管理が主な用事なので、一番上に置く */}
      {isFacilitator && <MenuSection heading="主催者メニュー" links={facilitatorLinks} />}
      <MenuSection heading="予約・お気に入り" links={reservationLinks} />
      <MenuSection heading="問い合わせ" links={inquiryLinks} />
      <MenuSection heading="ヘルプ・規約" links={HELP_DOCUMENTS} compact />

      {/* ログアウトは誤って押さないよう、メニューから離してページの一番下に置く */}
      <div className="mt-12 flex justify-center border-t border-border-muted pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="min-h-11 rounded-md border border-red-400/30 px-6 text-sm font-medium text-red-300 transition hover:bg-red-400/10 focus-visible:bg-red-400/10 focus-ring focus:outline-hidden"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
