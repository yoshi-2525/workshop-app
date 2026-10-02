import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { getInquiry, markInquiryRead, replyInquiry } from '@/api/inquiries'
import { extractErrorMessage } from '@/api/client'
import { useNotifications } from '@/context/NotificationContext'
import { Avatar } from '@/components/ui/Avatar'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { InquiryMessageList } from '@/components/inquiry/InquiryMessageList'
import type { InquiryDetail } from '@/types'
import { parseIdParam } from '@/utils/params'

// 開いている間に相手から届いたメッセージを表示するため、一定間隔で読み込み直す
const POLL_INTERVAL_MS = 15_000

export function InquiryThreadPage() {
  const { id } = useParams<{ id: string }>()
  const { refreshInquiryUnreadCount } = useNotifications()
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // 未読があれば既読にして、ナビバーの未読数も更新する
  const markReadIfNeeded = useCallback(
    async (detail: InquiryDetail) => {
      if (detail.unread_count === 0) return
      try {
        await markInquiryRead(detail.id)
        setInquiry((prev) => (prev?.id === detail.id ? { ...prev, unread_count: 0 } : prev))
        refreshInquiryUnreadCount()
      } catch {
        // 既読にできなくても表示には影響しないので、次の読み込みで改めて試す
      }
    },
    [refreshInquiryUnreadCount],
  )

  useEffect(() => {
    setInquiry(null)
    setError(null)
    setSendError(null)
    const inquiryId = parseIdParam(id)
    if (inquiryId === null) {
      setError('問い合わせが見つかりません')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    function load(initial: boolean) {
      getInquiry(inquiryId!, controller.signal)
        .then((detail) => {
          setInquiry(detail)
          markReadIfNeeded(detail)
        })
        .catch((err) => {
          if (axios.isCancel(err)) return
          // 定期的な読み込み直しの失敗は、表示中の内容を残して黙って次を待つ
          if (initial) setError(extractErrorMessage(err, '問い合わせの取得に失敗しました'))
        })
        .finally(() => {
          if (initial && !controller.signal.aborted) setLoading(false)
        })
    }

    setLoading(true)
    load(true)
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [id, markReadIfNeeded])

  async function handleSend(body: string) {
    if (!inquiry) return
    setSendError(null)
    try {
      setInquiry(await replyInquiry(inquiry.id, body))
    } catch (err) {
      setSendError(extractErrorMessage(err, '送信に失敗しました'))
      throw err
    }
  }

  const backLink = (
    <Link
      to="/inquiries"
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 hover:underline"
    >
      <span aria-hidden="true">←</span>
      問い合わせ一覧に戻る
    </Link>
  )

  if (loading)
    return (
      <p role="status" className="text-slate-500">
        読み込み中...
      </p>
    )
  if (error || !inquiry)
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p role="alert" className="text-red-600">
          {error ?? '問い合わせが見つかりません'}
        </p>
      </div>
    )

  const isParticipant = inquiry.my_role === 'participant'

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <div className="flex items-center gap-3 rounded-lg border border-border-muted bg-white p-4">
        <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} />
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-900">
            {isParticipant ? (
              <Link to={`/facilitators/${inquiry.counterpart_id}`} className="hover:underline">
                {inquiry.counterpart_name}
              </Link>
            ) : (
              inquiry.counterpart_name
            )}
            <span className="ml-2 text-xs font-normal text-slate-500">{isParticipant ? '主催者' : '参加者'}</span>
          </h1>
          <Link
            to={`/workshops/${inquiry.workshop_id}`}
            className="block truncate text-sm text-slate-600 underline hover:text-slate-900"
          >
            {inquiry.workshop_title}
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <InquiryMessageList messages={inquiry.messages} />
      </div>

      <div className="mt-6 border-t border-border-muted pt-4">
        {sendError && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {sendError}
          </p>
        )}
        <InquiryComposer onSend={handleSend} label={isParticipant ? '主催者へのメッセージ' : '参加者への返信'} />
      </div>
    </div>
  )
}
