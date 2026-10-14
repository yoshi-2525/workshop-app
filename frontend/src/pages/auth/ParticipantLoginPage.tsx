import { LoginForm } from '@/components/auth/LoginForm'

export function ParticipantLoginPage() {
  return (
    <LoginForm
      role="participant"
      description="参加予定のワークショップや、主催者とのやり取りを確認できます。"
      defaultRedirect="/"
    />
  )
}
