import { RegisterForm } from '@/components/auth/RegisterForm'

export function ParticipantRegisterPage() {
  return (
    <RegisterForm
      role="participant"
      description="ワークショップを探して予約できるようになります。"
      afterRegisterPath="/"
    />
  )
}
