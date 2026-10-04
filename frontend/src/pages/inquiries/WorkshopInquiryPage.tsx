import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshopInquiry, sendWorkshopInquiry } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { useApiResource } from '@/hooks/useApiResource'
import { parseIdParam } from '@/utils/params'

// ワークショップの主催者に問い合わせる。既にやり取りがあればそのページへ移り、なければ最初のメッセージを書く
export function WorkshopInquiryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sendError, setSendError] = useState<string | null>(null)
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
    setSendError(null)
    try {
      const inquiry = await sendWorkshopInquiry(workshop.id, body)
      navigate(`/inquiries/${inquiry.id}`, { replace: true })
    } catch (err) {
      setSendError(extractErrorMessage(err, '送信に失敗しました'))
      throw err
    }
  }

  const backLink = (
    <Link
      to={id ? `/workshops/${id}` : '/'}
      className="mb-4 inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg hover:underline"
    >
      <span aria-hidden="true">←</span>
      ワークショップに戻る
    </Link>
  )

  // 既存のやり取りへ移るまでの間も、読み込み中として表示する
  if (loading || existingInquiryId !== undefined)
    return (
      <p role="status" className="text-fg-muted">
        読み込み中...
      </p>
    )
  if (error || !workshop)
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p role="alert" className="text-red-300">
          {error ?? 'ワークショップが見つかりませんでした'}
        </p>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="text-xl font-semibold text-fg">主催者に問い合わせる</h1>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border-muted bg-surface p-4">
        <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} />
        <div className="min-w-0">
          <p className="font-medium text-fg">{workshop.facilitator_name}</p>
          <p className="truncate text-sm text-fg-secondary">{workshop.title}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-fg-secondary">
        ワークショップの内容や当日のことなど、気になることを主催者に質問できます。返信はナビゲーションの「問い合わせ」から確認できます。
      </p>
      <div className="mt-4">
        {sendError && (
          <p role="alert" className="mb-2 text-sm text-red-300">
            {sendError}
          </p>
        )}
        <InquiryComposer onSend={handleSend} label="問い合わせ内容" placeholder="例: 初めてでも参加できますか?" />
      </div>
    </div>
  )
}
