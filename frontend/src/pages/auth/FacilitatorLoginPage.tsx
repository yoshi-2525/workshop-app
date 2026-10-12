import { LoginForm } from '@/components/auth/LoginForm'

export function FacilitatorLoginPage() {
  return (
    <LoginForm
      role="facilitator"
      description="ワークショップの企画・運営を行います。"
      allowedRoles={['facilitator', 'admin']}
      wrongRoleMessage="このアカウントは主催者用ではありません。上の「参加者」からログインしてください。"
      defaultRedirect="/manage"
    />
  )
}
