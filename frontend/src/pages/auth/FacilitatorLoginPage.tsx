import { LoginForm } from '@/components/auth/LoginForm'

export function FacilitatorLoginPage() {
  return (
    <LoginForm
      role="facilitator"
      description="ワークショップの企画・運営を行います。"
      defaultRedirect="/manage"
    />
  )
}
