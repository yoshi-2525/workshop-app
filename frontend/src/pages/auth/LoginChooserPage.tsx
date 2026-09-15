import { Link } from 'react-router-dom'

export function LoginChooserPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-slate-900">ログイン</h1>
      <p className="mt-1 text-sm text-slate-500">アカウントの種類を選んでください。</p>
      <div className="mt-6 grid gap-4">
        <Link
          to="/login/participant"
          className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-slate-900">参加者としてログイン</h2>
          <p className="mt-1 text-sm text-slate-600">ワークショップを探して予約する方はこちら</p>
        </Link>
        <Link
          to="/login/facilitator"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-slate-900">主催者としてログイン</h2>
          <p className="mt-1 text-sm text-slate-600">ワークショップを企画・運営する方はこちら</p>
        </Link>
      </div>
    </div>
  )
}
