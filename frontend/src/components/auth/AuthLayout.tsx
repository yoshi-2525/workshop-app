import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { SelfRegisterRole } from '@/types'
import { PaperCard } from '@/components/ui/PaperCard'

export type AuthKind = 'login' | 'register'

const ROLE_LABEL: Record<SelfRegisterRole, string> = {
  participant: '参加者として',
  facilitator: '主催者として',
}

const KIND_TITLE: Record<AuthKind, string> = {
  login: 'ログイン',
  register: '新規登録',
}

// 参加者・主催者のどちらで使うかの切り替え。色ではなく小さな文字のラベルで示し、選んでいる方を濃くする。
// 以前の選択画面の代わりで、ログイン後の戻り先(state.from)は切り替え先にも引き継ぐ
function RoleSwitch({ kind, role }: { kind: AuthKind; role: SelfRegisterRole }) {
  const location = useLocation()
  return (
    <nav aria-label="アカウントの種類" className="mt-3 flex items-center gap-3 text-sm">
      {(Object.keys(ROLE_LABEL) as SelfRegisterRole[]).map((r, i) => (
        <span key={r} className="flex items-center gap-3">
          {i > 0 && (
            <span aria-hidden="true" className="text-fg-subtle">
              ｜
            </span>
          )}
          {r === role ? (
            <span aria-current="page" className="font-medium text-fg">
              {ROLE_LABEL[r]}
            </span>
          ) : (
            <Link
              to={`/${kind}/${r}`}
              state={location.state}
              replace
              className="text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline"
            >
              {ROLE_LABEL[r]}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

interface AuthLayoutProps {
  kind: AuthKind
  role: SelfRegisterRole
  // 見出しの下の、この画面でできることの説明
  description: string
  // 紙のカードに載せるフォーム
  children: ReactNode
  // カードの下に置く、ログインと新規登録を行き来するリンク
  footer: ReactNode
}

// ログイン・新規登録の画面の共通の骨組み。
// 夜の地に明朝の見出しを置き、フォームは受付で手渡される用紙のように紙のカードに載せる
export function AuthLayout({ kind, role, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="mx-auto max-w-sm py-6 sm:py-10">
      <h1 className="font-brand text-2xl font-semibold tracking-widest text-fg">{KIND_TITLE[kind]}</h1>
      <RoleSwitch kind={kind} role={role} />
      <p className="mt-3 text-sm text-fg-secondary">{description}</p>

      <PaperCard cornerFold={false} className="mt-6 p-5 sm:p-6">
        {children}
      </PaperCard>

      <div className="mt-5 text-sm text-fg-secondary">{footer}</div>
    </div>
  )
}
