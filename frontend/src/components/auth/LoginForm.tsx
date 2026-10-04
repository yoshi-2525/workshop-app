import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { UserRole } from '@/types'
import { authThemeStyles } from '@/components/auth/theme'
import type { AuthTheme } from '@/components/auth/theme'
import { ErrorMessage } from '@/components/ui/StatusMessage'

interface LoginFormProps {
  theme: AuthTheme
  title: string
  subtitle: string
  allowedRoles: UserRole[]
  wrongRoleMessage: string
  defaultRedirect: string
  registerTo: string
  registerLabel: string
  switchTo: string
  switchLabel: string
}

export function LoginForm({
  theme,
  title,
  subtitle,
  allowedRoles,
  wrongRoleMessage,
  defaultRedirect,
  registerTo,
  registerLabel,
  switchTo,
  switchLabel,
}: LoginFormProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const style = authThemeStyles[theme]
  const emailId = useId()
  const passwordId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email, password, allowedRoles)
      if (!user) {
        setError(wrongRoleMessage)
        return
      }
      const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRedirect
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err, 'ログインに失敗しました'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`-mx-4 -my-8 min-h-[70vh] px-4 py-12 ${style.panelBg}`}>
      <div className="mx-auto max-w-sm">
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style.badgeBg}`}>
          {style.badgeLabel}向け
        </span>
        <h1 className="mt-3 text-xl font-semibold text-fg">{title}</h1>
        <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg bg-surface p-5 shadow-sm">
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-fg-secondary">
              メールアドレス
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="block text-sm font-medium text-fg-secondary">
              パスワード
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
          </div>
          <ErrorMessage message={error} className="text-sm" />
          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${style.button}`}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-sm text-fg-secondary">
          アカウントをお持ちでない場合は{' '}
          <Link to={registerTo} className="text-fg underline">
            {registerLabel}
          </Link>
        </p>
        <p className="mt-1 text-sm text-fg-secondary">
          {/* ログイン後の戻り先(state.from)を切り替え先にも引き継ぐ */}
          <Link to={switchTo} state={location.state} className="text-fg underline">
            {switchLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
