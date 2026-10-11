import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/api/client'
import type { SelfRegisterRole } from '@/types'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, USER_NAME_MAX_LENGTH } from '@/utils/user'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

const PASSWORD_CHARS_MESSAGE = 'パスワードは半角英数字と記号で入力してください(全角文字・スペースは使えません)'

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

// 入力の誤りがある欄(aria-invalid)は枠線を赤くする
const VALIDATED_INPUT_CLASS = `${INPUT_CLASS} aria-invalid:border-red-500`

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
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const passwordHelpId = useId()
  const passwordConfirmId = useId()
  const passwordConfirmErrorId = useId()
  const agreementId = useId()
  const agreeCheckboxId = useId()
  // 全角文字やスペースが含まれているとき(入力した時点で知らせる)
  const passwordInvalidChars = !PASSWORD_PATTERN.test(password)
  const passwordErrorId = useId()
  // 確認用の欄に入力があり、パスワードと一致しないとき(入力の途中から知らせる)
  const passwordMismatch = passwordConfirm !== '' && passwordConfirm !== password
  const agreementTarget = role === 'facilitator' ? '利用規約と主催者ガイドライン' : '利用規約'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // required は空白だけの入力を通すので、ここで確かめる(バックエンドは前後の空白を除いてから検証する)
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードと確認用のパスワードが一致しません')
      return
    }
    if (!agreed) {
      setError(`${agreementTarget}に同意してください`)
      return
    }
    // maxLength は文字数でしか数えないので、日本語などを含むパスワードはバイト数でも確かめる
    if (passwordInvalidChars) {
      setError(PASSWORD_CHARS_MESSAGE)
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
        <div>
          <label htmlFor={nameId} className={LABEL_CLASS}>
            名前
          </label>
          <input
            id={nameId}
            autoComplete="name"
            required
            maxLength={USER_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordInvalidChars || undefined}
            aria-describedby={passwordInvalidChars ? `${passwordErrorId} ${passwordHelpId}` : passwordHelpId}
            className={VALIDATED_INPUT_CLASS}
          />
          {passwordInvalidChars && (
            <p id={passwordErrorId} className="mt-1 text-xs text-red-300">
              {PASSWORD_CHARS_MESSAGE}
            </p>
          )}
          <p id={passwordHelpId} className="mt-1 text-xs text-fg-muted">
            半角英数字・記号で{PASSWORD_MIN_LENGTH}～{PASSWORD_MAX_LENGTH}文字
          </p>
        </div>
        <div>
          <label htmlFor={passwordConfirmId} className={LABEL_CLASS}>
            パスワード(確認用)
          </label>
          <input
            id={passwordConfirmId}
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            aria-invalid={passwordMismatch || undefined}
            aria-describedby={passwordMismatch ? passwordConfirmErrorId : undefined}
            className={VALIDATED_INPUT_CLASS}
          />
          {passwordMismatch && (
            <p id={passwordConfirmErrorId} className="mt-1 text-xs text-red-300">
              パスワードが一致しません
            </p>
          )}
        </div>
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
