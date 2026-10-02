import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { SelfRegisterRole } from '@/types'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH, utf8ByteLength } from '@/utils/user'
import { authThemeStyles } from '@/components/auth/theme'

interface RegisterFormProps {
  title: string
  subtitle: string
  role: SelfRegisterRole
  afterRegisterPath: string
  loginTo: string
  loginLabel: string
  switchTo: string
  switchLabel: string
}

export function RegisterForm({
  title,
  subtitle,
  role,
  afterRegisterPath,
  loginTo,
  loginLabel,
  switchTo,
  switchLabel,
}: RegisterFormProps) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const style = authThemeStyles[role]
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const passwordHelpId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // maxLength は文字数でしか数えないので、日本語などを含むパスワードはバイト数でも確かめる
    if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) {
      setError(`パスワードは${PASSWORD_MAX_BYTES}バイト以内にしてください(日本語などは1文字3バイトです)`)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await register({ name, email, password, role })
      navigate(afterRegisterPath, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err, '登録に失敗しました'))
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
            <label htmlFor={nameId} className="block text-sm font-medium text-slate-700">
              名前
            </label>
            <input
              id={nameId}
              autoComplete="name"
              required
              maxLength={USER_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
          </div>
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-slate-700">
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
            <label htmlFor={passwordId} className="block text-sm font-medium text-slate-700">
              パスワード
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_BYTES}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={passwordHelpId}
              className={`mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none ${style.focusRing}`}
            />
            <p id={passwordHelpId} className="mt-1 text-xs text-slate-500">
              {PASSWORD_MIN_LENGTH}文字以上、{PASSWORD_MAX_BYTES}バイト以内(英数字なら{PASSWORD_MAX_BYTES}文字まで)
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${style.button}`}
          >
            {submitting ? '登録中...' : '登録する'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          すでにアカウントをお持ちの場合は{' '}
          <Link to={loginTo} className="text-slate-900 underline">
            {loginLabel}
          </Link>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <Link to={switchTo} className="text-slate-900 underline">
            {switchLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
