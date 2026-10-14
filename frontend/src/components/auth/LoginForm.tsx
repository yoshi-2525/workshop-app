import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { SelfRegisterRole } from '@/types'
import { AuthField } from '@/components/auth/AuthField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ROLE_LABEL } from '@/components/auth/roleLabels'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

interface LoginFormProps {
  // この画面からログインできる役割。ほかの役割のアカウント(管理者を含む)はログインさせない
  role: SelfRegisterRole
  description: string
  defaultRedirect: string
}

export function LoginForm({ role, description, defaultRedirect }: LoginFormProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // パスワードは合っているが、この画面の役割(role)のアカウントではないときのメッセージ
  const wrongRoleMessage = `このアカウントは${ROLE_LABEL[role]}用ではありません。`

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email, password, [role])
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
        <AuthField
          label="メールアドレス"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />
        <AuthField
          label="パスワード"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
        <ErrorMessage message={error} className="text-sm" />
        <button type="submit" disabled={submitting} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
          {submitting ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </AuthLayout>
  )
}
