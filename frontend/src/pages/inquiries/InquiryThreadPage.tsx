import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { getInquiry, markInquiryRead, replyInquiry } from '@/api/inquiries'
import { extractErrorMessage } from '@/api/client'
import { useNotifications } from '@/context/NotificationContext'
import { Avatar } from '@/components/ui/Avatar'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { InquiryMessageList } from '@/components/inquiry/InquiryMessageList'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { InquiryDetail } from '@/types'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'
import { BackLink } from '@/components/ui/BackLink'
import { useBackState } from '@/hooks/useBackState'

// 開いている間に相手から届いたメッセージを表示するため、一定間隔で読み込み直す
const POLL_INTERVAL_MS = 15_000

export function InquiryThreadPage() {
  const workshopBackState = useBackState('問い合わせ')
  const { id } = useParams<{ id: string }>()
  const { refreshInquiryUnreadCount } = useNotifications()
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { run: runSend, error: sendError, clearError: clearSendError } = useAsyncAction()
  // 送信するたびに増やす。読み込み直しの途中で送信した場合、その読み込みの結果(送信前の内容)で上書きしないため
  const sendVersionRef = useRef(0)

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
    clearSendError()
    const inquiryId = parseIdParam(id)
    if (inquiryId === null) {
      setError('問い合わせが見つかりません')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    function load(initial: boolean) {
      const version = sendVersionRef.current
      getInquiry(inquiryId!, controller.signal)
        .then((detail) => {
          if (version !== sendVersionRef.current) return
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
  }, [id, markReadIfNeeded, clearSendError])

  async function handleSend(body: string) {
    if (!inquiry) return
    sendVersionRef.current += 1
    const sent = await runSend(() => replyInquiry(inquiry.id, body), '送信に失敗しました')
    // 失敗したら InquiryComposer が入力を残せるよう、エラーを投げ直す
    if (!sent.ok) throw sent.error
    setInquiry(sent.value)
  }

  const backLink = (
    <BackLink to="/inquiries">問い合わせ一覧に戻る</BackLink>
  )

  if (loading)
    return (
      <LoadingMessage />
    )
  if (error || !inquiry)
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <ErrorMessage message={error ?? '問い合わせが見つかりません'} />
      </div>
    )

  const isParticipant = inquiry.my_role === 'participant'

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <PaperCard cornerFold={false} className="flex items-center gap-3 p-4">
        <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} />
        <div className="min-w-0">
          <h1 className="font-semibold text-fg">
            {isParticipant ? (
              <Link to={`/facilitators/${inquiry.counterpart_id}`} className="hover:underline">
                {inquiry.counterpart_name}
              </Link>
            ) : (
              inquiry.counterpart_name
            )}
            <span className="ml-2 text-xs font-normal text-fg-muted">{isParticipant ? '主催者' : '参加者'}</span>
          </h1>
          <Link
            to={`/workshops/${inquiry.workshop_id}`}
            state={workshopBackState}
            className="block truncate text-sm text-fg-secondary underline hover:text-fg"
          >
            {inquiry.workshop_title}
          </Link>
        </div>
      </PaperCard>

      <div className="mt-6">
        <InquiryMessageList messages={inquiry.messages} />
      </div>

      <div className="mt-6 border-t border-border-muted pt-4">
        <ErrorMessage message={sendError} className="mb-2 text-sm" />
        <InquiryComposer onSend={handleSend} label={isParticipant ? '主催者へのメッセージ' : '参加者への返信'} />
      </div>
    </div>
  )
}
