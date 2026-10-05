import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PaperCard } from '@/components/ui/PaperCard'
import { BackLink } from '@/components/ui/BackLink'
import { useForwardedBackState } from '@/hooks/useBackState'

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
      <BackLink to="/help">ヘルプ・規約の一覧に戻る</BackLink>
      <PaperCard as="article" cornerFold={false} className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        <p className="mt-1 text-sm text-fg-muted">最終改定日: {updatedAt}</p>
        <div className="mt-6 space-y-8 text-sm leading-relaxed text-fg-secondary">{children}</div>
      </PaperCard>
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

// 文書の中から別の文書へのリンク。この文書が受け取った戻り先を引き継ぎ、
// 文書をいくつかたどったあとも「← ○○に戻る」で最初に来たページ(マイページなど)へ戻れるようにする
export function LegalDocLink({ to, children }: { to: string; children: ReactNode }) {
  const backState = useForwardedBackState()
  return (
    <Link to={to} state={backState} className="underline">
      {children}
    </Link>
  )
}
