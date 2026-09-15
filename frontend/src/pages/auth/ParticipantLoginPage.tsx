import { LoginForm } from '../../components/auth/LoginForm'

export function ParticipantLoginPage() {
  return (
    <LoginForm
      theme="participant"
      title="参加者ログイン"
      subtitle="ワークショップの予約・管理を行います。"
      allowedRoles={['participant']}
      wrongRoleMessage="このアカウントは参加者用ではありません。主催者ログインをご利用ください。"
      defaultRedirect="/"
      registerTo="/register/participant"
      registerLabel="参加者として新規登録"
      switchTo="/login/facilitator"
      switchLabel="主催者としてログインする方はこちら"
    />
  )
}
