import { useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HELP_DOCUMENTS } from '@/pages/help/helpDocuments'
import { canManageWorkshops } from '@/utils/user'
import { ADMIN_PAYOUT_REQUESTS_PATH, PAYOUT_SETTINGS_PATH } from '@/utils/payment'
import { PaperCard } from '@/components/ui/PaperCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useBackState } from '@/hooks/useBackState'

interface MenuLink {
  to: string
  title: string
  description: string
}

function MenuLinkList({ links }: { links: MenuLink[] }) {
  const backState = useBackState('マイページ')
  return (
    <ul className="mt-3 space-y-3">
      {links.map((link) => (
        <PaperCard as="li" key={link.to} cornerFold={false} interactive>
          <Link
            to={link.to}
            state={backState}
            className="flex items-center justify-between rounded-lg p-4 focus:outline-none"
          >
            <div>
              <p className="font-medium text-fg">{link.title}</p>
              {/* 説明が1行でも2行でもカードの高さがそろうよう、説明は2行分の高さを確保する */}
              <p className="mt-0.5 min-h-[2lh] text-sm text-fg-muted">{link.description}</p>
            </div>
            <MaterialIcon name="chevron_right" className="shrink-0 text-[24px] text-fg-subtle" />
          </Link>
        </PaperCard>
      ))}
    </ul>
  )
}

// 見出し付きのメニューのまとまり
function MenuSection({ heading, links }: { heading: string; links: MenuLink[] }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-base font-semibold text-fg-secondary">
        {heading}
      </h2>
      <MenuLinkList links={links} />
    </section>
  )
}

// マイページ(/me)。自分の予約・お気に入り・問い合わせ・アカウントなど、ログイン中の人向けのメニューを性質ごとにまとめる
export function MyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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

  const accountLinks: MenuLink[] = [
    {
      to: '/me/profile',
      title: 'プロフィール編集',
      description: '表示名や自己紹介を編集します。',
    },
  ]

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">マイページ</h1>
      <MenuSection heading="予約・お気に入り" links={reservationLinks} />
      {/* ワークショップを開けるのは主催者と運営だけ */}
      {isFacilitator && <MenuSection heading="主催者メニュー" links={facilitatorLinks} />}
      <MenuSection heading="問い合わせ" links={inquiryLinks} />
      <MenuSection heading="アカウント" links={accountLinks} />
      <MenuSection heading="ヘルプ・規約" links={HELP_DOCUMENTS} />
      {/* ログアウトは誤って押さないよう、メニューから離してページの一番下に置く */}
      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 w-full rounded-lg border border-border bg-surface p-3 text-sm font-medium text-red-300 transition hover:bg-red-400/10 focus-ring focus:outline-none"
      >
        ログアウト
      </button>
    </div>
  )
}
