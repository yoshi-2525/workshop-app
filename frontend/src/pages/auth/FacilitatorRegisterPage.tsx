import { RegisterForm } from '@/components/auth/RegisterForm'

export function FacilitatorRegisterPage() {
  return (
    <RegisterForm
      title="主催者登録"
      subtitle="ワークショップを企画・運営できるようになります。"
      role="facilitator"
      afterRegisterPath="/manage"
      loginTo="/login/facilitator"
      loginLabel="主催者ログイン"
      switchTo="/register/participant"
      switchLabel="参加者として登録する方はこちら"
    />
  )
}
