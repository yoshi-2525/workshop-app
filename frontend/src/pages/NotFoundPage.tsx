import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-brand text-2xl font-semibold tracking-widest text-fg">ページが見つかりません</h1>
      <p className="mt-4 text-fg-muted">少し、道に迷ってしまったようです。</p>
      <Link to="/" className="mt-8 inline-block text-fg-secondary underline underline-offset-4 hover:text-fg">
        はじめの場所に戻る
      </Link>
    </div>
  )
}
