import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getWorkshopInquiry, sendWorkshopInquiry } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { Avatar } from '@/components/ui/Avatar'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'
import { BackLink } from '@/components/ui/BackLink'

// ワークショップの主催者に問い合わせる。既にやり取りがあればそのページへ移り、なければ最初のメッセージを書く
export function WorkshopInquiryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { run: runSend, error: sendError } = useAsyncAction()
  const workshopId = parseIdParam(id)
  const { data, loading, error } = useApiResource(
    workshopId === null ? null : `workshop-inquiry:${workshopId}`,
    (signal) => Promise.all([getWorkshop(workshopId!, signal), getWorkshopInquiry(workshopId!, signal)]),
    'ワークショップの取得に失敗しました',
  )
  const workshop = data?.[0]
  const existingInquiryId = data?.[1]?.id

  // 既にやり取りがあれば、そのページへ移る
  useEffect(() => {
    if (existingInquiryId !== undefined) navigate(`/inquiries/${existingInquiryId}`, { replace: true })
  }, [existingInquiryId, navigate])

  async function handleSend(body: string) {
    if (!workshop) return
    const sent = await runSend(() => sendWorkshopInquiry(workshop.id, body), '送信に失敗しました')
    // 失敗したら InquiryComposer が入力を残せるよう、エラーを投げ直す
    if (!sent.ok) throw sent.error
    navigate(`/inquiries/${sent.value.id}`, { replace: true })
  }

  const backLink = (
    <BackLink to={id ? `/workshops/${id}` : '/'}>ワークショップに戻る</BackLink>
  )

  // 既存のやり取りへ移るまでの間も、読み込み中として表示する
  if (loading || existingInquiryId !== undefined)
    return (
      <LoadingMessage />
    )
  if (error || !workshop)
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <ErrorMessage message={error ?? 'ワークショップが見つかりませんでした'} />
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="text-xl font-semibold text-fg">主催者に問い合わせる</h1>
      <PaperCard cornerFold={false} className="mt-4 flex items-center gap-3 p-4">
        <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} />
        <div className="min-w-0">
          <p className="font-medium text-fg">{workshop.facilitator_name}</p>
          <p className="truncate text-sm text-fg-secondary">{workshop.title}</p>
        </div>
      </PaperCard>
      <p className="mt-4 text-sm text-fg-secondary">
        ワークショップの内容や当日のことなど、気になることを主催者に質問できます。返信はナビゲーションの「問い合わせ」から確認できます。
      </p>
      <div className="mt-4">
        <ErrorMessage message={sendError} className="mb-2 text-sm" />
        <InquiryComposer onSend={handleSend} label="問い合わせ内容" placeholder="例: 初めてでも参加できますか?" />
      </div>
    </div>
  )
}
