import { Link } from 'react-router-dom'

export function LoginChooserPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-fg">ログイン</h1>
      <p className="mt-1 text-sm text-fg-muted">アカウントの種類を選んでください。</p>
      <div className="mt-6 grid gap-4">
        <Link
          to="/login/participant"
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-fg">参加者としてログイン</h2>
          <p className="mt-1 text-sm text-fg-secondary">ワークショップを探して予約する方はこちら</p>
        </Link>
        <Link
          to="/login/facilitator"
          className="rounded-lg border border-indigo-400/30 bg-indigo-400/10 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-fg">主催者としてログイン</h2>
          <p className="mt-1 text-sm text-fg-secondary">ワークショップを企画・運営する方はこちら</p>
        </Link>
      </div>
    </div>
  )
}
