import { useState } from 'react'
import { broadcastWorkshopInquiry } from '@/api/inquiries'
import { extractErrorMessage } from '@/api/client'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import type { Workshop } from '@/types'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'

interface BroadcastComposerProps {
  workshop: Workshop
  // 送信できたあとに呼ぶ(問い合わせ一覧を読み込み直すなど)
  onSent: () => void
}

// 主催者が、予約している参加者全員にお知らせを一斉送信するフォーム。
// お知らせは各参加者とのやり取りに1通ずつ届き、参加者は「問い合わせ」から確認・返信できる
export function BroadcastComposer({ workshop, onSent }: BroadcastComposerProps) {
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function handleSend(body: string) {
    setError(null)
    setResult(null)
    if (!confirm(`「${workshop.title}」を予約している参加者全員に、このお知らせを送信しますか?`)) {
      // 取り消したときは入力内容を残す(InquiryComposer は reject されると入力を消さない)
      throw new Error('canceled')
    }
    try {
      const sentCount = await broadcastWorkshopInquiry(workshop.id, body)
      setResult(`${sentCount}名の参加者にお知らせを送信しました。`)
      onSent()
    } catch (err) {
      setError(extractErrorMessage(err, 'お知らせの送信に失敗しました'))
      throw err
    }
  }

  return (
    <PaperCard as="section" aria-labelledby="broadcast-heading" cornerFold={false} className="mt-6 p-4">
      <h2 id="broadcast-heading" className="text-base font-semibold text-fg">
        参加者全員へのお知らせ
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        予約している参加者全員に、同じメッセージを一斉に送信します。持ち物や集合場所など、開催の詳細のご案内にお使いください。
        参加者は「問い合わせ」から確認・返信できます。
      </p>
      <div className="mt-3">
        <ErrorMessage message={error} className="mb-2 text-sm" />
        {result && (
          <p role="status" className="mb-2 text-sm text-emerald-300">
            {result}
          </p>
        )}
        <InquiryComposer
          onSend={handleSend}
          label="お知らせの内容"
          placeholder="例: 当日は筆記用具をお持ちください。会場の入口は建物の東側です。"
        />
      </div>
    </PaperCard>
  )
}
