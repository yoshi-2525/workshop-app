import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshopInquiry, sendWorkshopInquiry } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import type { Workshop } from '@/types'
import { parseIdParam } from '@/utils/params'

// ワークショップの主催者に問い合わせる。既にやり取りがあればそのページへ移り、なければ最初のメッセージを書く
export function WorkshopInquiryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    setWorkshop(null)
    setError(null)
    const workshopId = parseIdParam(id)
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    Promise.all([getWorkshop(workshopId, controller.signal), getWorkshopInquiry(workshopId, controller.signal)])
      .then(([w, inquiry]) => {
        if (inquiry) {
          navigate(`/inquiries/${inquiry.id}`, { replace: true })
          return
        }
        setWorkshop(w)
      })
      .catch((err) => {
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id, navigate])

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
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 hover:underline"
    >
      <span aria-hidden="true">←</span>
      ワークショップに戻る
    </Link>
  )

  if (loading)
    return (
      <p role="status" className="text-slate-500">
        読み込み中...
      </p>
    )
  if (error || !workshop)
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p role="alert" className="text-red-600">
          {error ?? 'ワークショップが見つかりませんでした'}
        </p>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="text-xl font-semibold text-slate-900">主催者に問い合わせる</h1>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border-muted bg-white p-4">
        <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} />
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{workshop.facilitator_name}</p>
          <p className="truncate text-sm text-slate-600">{workshop.title}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        ワークショップの内容や当日のことなど、気になることを主催者に質問できます。返信はナビゲーションの「問い合わせ」から確認できます。
      </p>
      <div className="mt-4">
        {sendError && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {sendError}
          </p>
        )}
        <InquiryComposer onSend={handleSend} label="問い合わせ内容" placeholder="例: 初めてでも参加できますか?" />
      </div>
    </div>
  )
}
