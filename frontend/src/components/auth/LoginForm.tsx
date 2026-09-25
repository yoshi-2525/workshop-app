import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import type { UserRole } from '../../types'
import { authThemeStyles } from './theme'
import type { AuthTheme } from './theme'

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
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const style = authThemeStyles[theme]

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email, password)
      if (!allowedRoles.includes(user.role)) {
        logout()
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
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg bg-white p-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${style.button}`}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          アカウントをお持ちでない場合は{' '}
          <Link to={registerTo} className="text-slate-900 underline">
            {registerLabel}
          </Link>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {/* ログイン後の戻り先(state.from)を切り替え先にも引き継ぐ */}
          <Link to={switchTo} state={location.state} className="text-slate-900 underline">
            {switchLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
