import { RegisterForm } from '@/components/auth/RegisterForm'

export function FacilitatorRegisterPage() {
  return (
    <RegisterForm
      role="facilitator"
      description="ワークショップを企画・運営できるようになります。"
      afterRegisterPath="/manage"
    />
  )
}
