import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// 規約・ガイドラインなどの文書ページの共通レイアウト。見出しの番号は呼び出し側で title に含める
export function LegalDocument({
  title,
  updatedAt,
  children,
}: {
  title: string
  // 制定日・最終改定日(例: 2026年10月2日)
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/help"
        className="mb-4 inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg hover:underline"
      >
        <span aria-hidden="true">←</span>
        ヘルプ・規約の一覧に戻る
      </Link>
      <article className="rounded-lg border border-border-muted bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        <p className="mt-1 text-sm text-fg-muted">最終改定日: {updatedAt}</p>
        <div className="mt-6 space-y-8 text-sm leading-relaxed text-fg-secondary">{children}</div>
      </article>
    </div>
  )
}

// 文書の中の1つの条・項目
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}

// 番号付きの箇条書き(条文の各号など)
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}
