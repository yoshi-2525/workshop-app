import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshopInquiry, sendWorkshopInquiry } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'
import { BackLink } from '@/components/ui/BackLink'
import { useBackState } from '@/hooks/useBackState'

// ワークショップの主催者に問い合わせる。既にやり取りがあればそのページへ移り、なければ最初のメッセージを書く
export function WorkshopInquiryPage() {
  const backState = useBackState('主催者への問い合わせ')
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
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        ワークショップの内容や当日のことなど、気になることを主催者に質問できます。
      </p>

      {/* トーク画面と同じく、「誰に聞くか」は暗い面のカード、「何を書くか」は紙のカードに分ける */}
      <section aria-label="問い合わせ先" className="mt-6 rounded-lg bg-surface-muted p-5 shadow-card sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} className="h-14 w-14 text-xl" />
          <div className="min-w-0">
            <p className="text-xs tracking-wider text-fg-muted">主催者</p>
            <p className="mt-0.5 break-all text-xl font-semibold text-fg">
              <Link to={`/facilitators/${workshop.facilitator_id}`} state={backState} className="hover:underline">
                {workshop.facilitator_name}
              </Link>
            </p>
          </div>
        </div>
        <Link
          to={`/workshops/${workshop.id}`}
          className="mt-4 flex items-center gap-3 rounded-md bg-surface px-3.5 py-3 transition-colors hover:bg-surface-strong focus-ring focus:outline-hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-fg-muted">対象のワークショップ</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-fg">{workshop.title}</span>
          </span>
          <MaterialIcon name="chevron_right" className="shrink-0 text-[20px] text-fg-subtle" />
        </Link>
      </section>

      {/* 入力欄は紙のカード。中の入力欄と送信ボタンは theme-paper で紙用の色に切り替わる */}
      <PaperCard as="section" aria-label="問い合わせを書く" cornerFold={false} className="mt-8 p-5 sm:px-6">
        <ErrorMessage message={sendError} className="mb-2 text-sm" />
        <InquiryComposer
          onSend={handleSend}
          label="問い合わせ内容"
          placeholder="例: 初めてでも参加できますか?"
        />
        <p className="mt-2 border-t border-border pt-2 text-[13px] leading-relaxed text-fg-muted">
          送ったあとのやり取りと主催者からの返信は、ナビゲーションの「問い合わせ」から確認できます。
        </p>
      </PaperCard>
    </div>
  )
}
