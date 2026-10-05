import { Link } from 'react-router-dom'
import { useBackState } from '@/hooks/useBackState'
import type { Workshop } from '@/types'
import { cancellationSummary } from '@/utils/payment'

const CANCELLATION_POLICY_PATH = '/help/cancellation-policy'
const LINK_CLASS = 'underline hover:text-fg-secondary'

// 有料のワークショップの、キャンセルと返金についての案内(本サービス共通のキャンセルポリシーの要約)。
// 無料なら何も出さない。ワークショップ詳細と予約フォームで同じ見た目にする(囲みの余白などは呼び出し側で付ける)
export function CancellationPolicy({
  workshop,
  id,
  headingAs: Heading = 'h2',
  openInNewTab = false,
  className = '',
}: {
  workshop: Pick<Workshop, 'price' | 'payment_method'>
  // 案内文の id。確認のチェックボックスなどから aria-describedby で参照する
  id?: string
  // 見出しの要素。ページの見出し構造に合わせて選ぶ(フォームの中など、見出しにしない場所では p)
  headingAs?: 'h2' | 'h3' | 'p'
  // 入力中のフォームの中に置くときは true。同じタブで移動すると入力が消えるので、ポリシーを新しいタブで開く
  openInNewTab?: boolean
  className?: string
}) {
  // ポリシーのページから、このワークショップの画面に戻れるようにする
  const backState = useBackState('ワークショップ詳細')
  const summary = cancellationSummary(workshop)
  if (summary === null) return null
  return (
    <div className={className}>
      <Heading className="text-xs font-semibold text-fg-secondary">キャンセルについて</Heading>
      <p id={id} className="mt-1 text-xs text-fg-muted">
        {summary}
        詳しくは
        {openInNewTab ? (
          <Link to={CANCELLATION_POLICY_PATH} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            キャンセルポリシー
            <span className="sr-only">(新しいタブで開きます)</span>
          </Link>
        ) : (
          <Link to={CANCELLATION_POLICY_PATH} state={backState} className={LINK_CLASS}>
            キャンセルポリシー
          </Link>
        )}
        をご覧ください。
      </p>
    </div>
  )
}
