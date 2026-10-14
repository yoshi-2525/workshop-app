import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { SelfRegisterRole } from '@/types'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@/utils/user'
import { passwordCharsError, passwordConfirmError, validateRegisterForm } from '@/utils/registerValidation'
import { AuthField } from '@/components/auth/AuthField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

// 規約へのリンク。新しいタブで開くことを読み上げでも伝える
function LegalLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline underline-offset-2">
      {children}
      <span className="sr-only">(新しいタブで開きます)</span>
    </Link>
  )
}

interface RegisterFormProps {
  role: SelfRegisterRole
  description: string
  afterRegisterPath: string
}

export function RegisterForm({ role, description, afterRegisterPath }: RegisterFormProps) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  // 規約に同意するまで登録ボタンは押せない
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const agreementId = useId()
  const agreeCheckboxId = useId()
  const agreementTarget = role === 'facilitator' ? '利用規約と主催者ガイドライン' : '利用規約'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationError = validateRegisterForm({ name, password, passwordConfirm, agreed }, agreementTarget)
    if (validationError) {
      setError(validationError)
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
    <AuthLayout
      kind="register"
      role={role}
      description={description}
      footer={
        <p>
          すでにアカウントをお持ちの場合は{' '}
          <Link to={`/login/${role}`} className="text-fg underline underline-offset-4">
            ログイン
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="名前"
          autoComplete="name"
          required
          maxLength={USER_NAME_MAX_LENGTH}
          value={name}
          onChange={setName}
        />
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
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={setPassword}
          error={passwordCharsError(password)}
          help={`半角英数字・記号で${PASSWORD_MIN_LENGTH}～${PASSWORD_MAX_LENGTH}文字`}
        />
        <AuthField
          label="パスワード(確認用)"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          error={passwordConfirmError(password, passwordConfirm)}
        />
        <ErrorMessage message={error} className="text-sm" />
        {/* 規約は入力中の内容を消さないよう、新しいタブで開く */}
        <p id={agreementId} className="text-xs leading-relaxed text-fg-secondary">
          <LegalLink to="/help/terms">利用規約</LegalLink>
          {role === 'facilitator' && (
            <>
              と<LegalLink to="/help/facilitator-guidelines">主催者ガイドライン</LegalLink>
            </>
          )}
          をお読みいただき、同意のうえ登録してください。
        </p>
        {/* リンクを押したときにチェックが切り替わらないよう、規約へのリンクはラベルの外(上の案内文)に置く */}
        <div className="flex items-start gap-2">
          <input
            id={agreeCheckboxId}
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            aria-describedby={agreementId}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent focus-ring focus:outline-none"
          />
          <label htmlFor={agreeCheckboxId} className="text-sm font-medium text-fg-secondary">
            {agreementTarget}に同意する
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting || !agreed}
          className={`w-full disabled:cursor-not-allowed ${PRIMARY_BUTTON_CLASS}`}
        >
          {submitting ? '登録中...' : '登録する'}
        </button>
      </form>
    </AuthLayout>
  )
}
