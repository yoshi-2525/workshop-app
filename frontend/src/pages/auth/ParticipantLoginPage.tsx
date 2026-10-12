import { LoginForm } from '@/components/auth/LoginForm'

export function ParticipantLoginPage() {
  return (
    <LoginForm
      role="participant"
      description="参加予定のワークショップや、主催者とのやり取りを確認できます。"
      allowedRoles={['participant']}
      wrongRoleMessage="このアカウントは参加者用ではありません。上の「主催者」からログインしてください。"
      defaultRedirect="/"
    />
  )
}
