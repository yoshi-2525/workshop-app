import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { SelfRegisterRole, UserRole } from '@/types'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

interface LoginFormProps {
  role: SelfRegisterRole
  description: string
  allowedRoles: UserRole[]
  wrongRoleMessage: string
  defaultRedirect: string
}

export function LoginForm({ role, description, allowedRoles, wrongRoleMessage, defaultRedirect }: LoginFormProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
    <AuthLayout
      kind="login"
      role={role}
      description={description}
      footer={
        <p>
          アカウントをお持ちでない場合は{' '}
          <Link to={`/register/${role}`} className="text-fg underline underline-offset-4">
            新規登録
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailId} className={LABEL_CLASS}>
            メールアドレス
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor={passwordId} className={LABEL_CLASS}>
            パスワード
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <ErrorMessage message={error} className="text-sm" />
        <button type="submit" disabled={submitting} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
          {submitting ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </AuthLayout>
  )
}
