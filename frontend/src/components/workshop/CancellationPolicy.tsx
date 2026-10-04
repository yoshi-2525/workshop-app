// 有料のワークショップのキャンセルポリシー。無料、または未入力なら何も出さない。
// ワークショップ詳細と予約フォームで同じ見た目にする(囲みの余白などは呼び出し側で付ける)
export function CancellationPolicy({
  price,
  policy,
  headingAs: Heading = 'h2',
  className = '',
}: {
  price: number
  policy: string
  // 見出しの要素。ページの見出し構造に合わせて選ぶ(フォームの中など、見出しにしない場所では p)
  headingAs?: 'h2' | 'h3' | 'p'
  className?: string
}) {
  if (price <= 0 || !policy) return null
  return (
    <div className={className}>
      <Heading className="text-xs font-semibold text-fg-secondary">キャンセルポリシー</Heading>
      <p className="mt-1 whitespace-pre-wrap text-xs text-fg-muted">{policy}</p>
    </div>
  )
}
