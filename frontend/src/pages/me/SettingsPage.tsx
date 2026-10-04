import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HELP_DOCUMENTS } from '@/pages/help/helpDocuments'
import { canManageWorkshops } from '@/utils/user'

interface SettingsLink {
  to: string
  title: string
  description: string
}

function SettingsLinkList({ links }: { links: SettingsLink[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {links.map((link) => (
        <li key={link.to}>
          <Link
            to={link.to}
            className="flex items-center justify-between rounded-lg border border-border-muted bg-surface p-4 shadow-sm transition hover:shadow-md"
          >
            <div>
              <p className="font-medium text-fg">{link.title}</p>
              <p className="mt-0.5 text-sm text-fg-muted">{link.description}</p>
            </div>
            <span aria-hidden="true" className="text-fg-subtle">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isFacilitator = canManageWorkshops(user)

  const links: SettingsLink[] = [
    {
      to: '/settings/profile',
      title: 'プロフィール編集',
      description: '表示名や自己紹介を編集します。',
    },
    ...(isFacilitator
      ? [
          {
            to: '/manage',
            title: 'ワークショップの管理',
            description: '自分のワークショップの作成・編集・削除、予約状況の確認を行います。',
          },
        ]
      : []),
    {
      to: '/reservations',
      title: '予約履歴・参加履歴',
      description: '参加予定のワークショップの確認や、過去に参加した履歴を見られます。',
    },
    {
      to: '/inquiries',
      title: '問い合わせ',
      description: isFacilitator
        ? '主催者への問い合わせや、自分のワークショップに届いた問い合わせのやり取りを確認できます。'
        : '主催者への問い合わせのやり取りを確認できます。',
    },
    {
      to: '/favorites',
      title: 'お気に入り',
      description: 'お気に入りに登録したワークショップを確認できます。',
    },
  ]

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">設定</h1>
      <div className="mt-3">
        <SettingsLinkList links={links} />
      </div>
      <section aria-labelledby="help-heading" className="mt-8">
        <h2 id="help-heading" className="text-base font-semibold text-fg-secondary">
          ヘルプ・規約
        </h2>
        <SettingsLinkList links={HELP_DOCUMENTS} />
      </section>
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
