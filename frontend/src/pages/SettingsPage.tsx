import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface SettingsLink {
  to: string
  title: string
  description: string
}

export function SettingsPage() {
  const { user } = useAuth()
  if (!user) return null

  const isFacilitator = user.role === 'admin' || user.role === 'facilitator'

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
      description: '参加予定のワークショップの確認・キャンセル、過去に参加した履歴を見られます。',
    },
  ]

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">設定</h1>
      <ul className="mt-6 space-y-3">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-slate-900">{link.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{link.description}</p>
              </div>
              <span className="text-slate-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
