import { Link } from 'react-router-dom'

export function RegisterChooserPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-slate-900">新規登録</h1>
      <p className="mt-1 text-sm text-slate-500">アカウントの種類を選んでください。</p>
      <div className="mt-6 grid gap-4">
        <Link
          to="/register/participant"
          className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-slate-900">参加者として登録</h2>
          <p className="mt-1 text-sm text-slate-600">ワークショップを探して予約する方はこちら</p>
        </Link>
        <Link
          to="/register/facilitator"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-base font-semibold text-slate-900">主催者として登録</h2>
          <p className="mt-1 text-sm text-slate-600">ワークショップを企画・運営する方はこちら</p>
        </Link>
      </div>
    </div>
  )
}
