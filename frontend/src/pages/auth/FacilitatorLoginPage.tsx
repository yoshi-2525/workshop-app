import { LoginForm } from '../../components/auth/LoginForm'

export function FacilitatorLoginPage() {
  return (
    <LoginForm
      theme="facilitator"
      title="主催者ログイン"
      subtitle="ワークショップの企画・運営を行います。"
      allowedRoles={['facilitator', 'admin']}
      wrongRoleMessage="このアカウントは主催者用ではありません。参加者ログインをご利用ください。"
      defaultRedirect="/manage"
      registerTo="/register/facilitator"
      registerLabel="主催者として新規登録"
      switchTo="/login/participant"
      switchLabel="参加者としてログインする方はこちら"
    />
  )
}
