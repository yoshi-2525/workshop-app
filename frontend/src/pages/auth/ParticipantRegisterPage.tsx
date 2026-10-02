import { RegisterForm } from '@/components/auth/RegisterForm'

export function ParticipantRegisterPage() {
  return (
    <RegisterForm
      title="参加者登録"
      subtitle="ワークショップを探して予約できるようになります。"
      role="participant"
      afterRegisterPath="/"
      loginTo="/login/participant"
      loginLabel="参加者ログイン"
      switchTo="/register/facilitator"
      switchLabel="主催者として登録する方はこちら"
    />
  )
}
