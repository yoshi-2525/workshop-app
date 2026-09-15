import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">ページが見つかりません</h1>
      <Link to="/" className="mt-4 inline-block text-slate-600 underline">
        トップに戻る
      </Link>
    </div>
  )
}
