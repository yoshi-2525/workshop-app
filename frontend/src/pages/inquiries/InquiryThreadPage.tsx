import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { getInquiry, markInquiryRead, replyInquiry } from '@/api/inquiries'
import { extractErrorMessage } from '@/api/client'
import { useNotifications } from '@/context/NotificationContext'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { InquiryComposer } from '@/components/inquiry/InquiryComposer'
import { InquiryMessageList } from '@/components/inquiry/InquiryMessageList'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { InquiryDetail } from '@/types'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
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


  if (loading)
    return (
      <LoadingMessage />
    )
  if (error || !inquiry)
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumb />
        <ErrorMessage message={error ?? '問い合わせが見つかりません'} />
      </div>
    )

  const isParticipant = inquiry.my_role === 'participant'

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb />
      {/* 画面を「誰と(相手とワークショップ)」「何を話したか(やり取り)」「何を送るか(送信欄)」の3つに分け、
          面の違いで見分けられるようにする: 相手は暗い面のカード、やり取りは枠線で囲んだ一段暗い面、送信欄は紙のカード */}
      <section aria-labelledby="counterpart-name" className="rounded-lg bg-surface-muted p-5 shadow-card sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} className="h-14 w-14 text-xl" />
          <div className="min-w-0">
            <p className="text-xs tracking-wider text-fg-muted">
              {isParticipant ? '主催者への問い合わせ' : '参加者からの問い合わせ'}
            </p>
            <h1 id="counterpart-name" className="mt-0.5 break-all text-xl font-semibold text-fg">
              {isParticipant ? (
                <Link to={`/facilitators/${inquiry.counterpart_id}`} className="hover:underline">
                  {inquiry.counterpart_name}
                </Link>
              ) : (
                inquiry.counterpart_name
              )}
            </h1>
          </div>
        </div>
        <Link
          to={`/workshops/${inquiry.workshop_id}`}
          state={workshopBackState}
          className="mt-4 flex items-center gap-3 rounded-md bg-surface px-3.5 py-3 transition-colors hover:bg-surface-strong focus-ring focus:outline-hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-fg-muted">対象のワークショップ</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-fg">{inquiry.workshop_title}</span>
          </span>
          <MaterialIcon name="chevron_right" className="shrink-0 text-[20px] text-fg-subtle" />
        </Link>
      </section>

      {/* 余白とスクロールは InquiryMessageList の中で付ける(スクロールバーを欄の端に出すため) */}
      <section aria-label="やり取り" className="mt-8 overflow-hidden rounded-lg border border-border-muted bg-surface/60">
        <InquiryMessageList messages={inquiry.messages} counterpartAvatarUrl={inquiry.counterpart_avatar_url} />
      </section>

      {/* 送信欄は紙のカード。中の入力欄と送信ボタンは theme-paper で紙用の色に切り替わる。
          右下の送信ボタンと重ならないよう、角の折れは付けない */}
      <PaperCard as="section" aria-label="送信欄" cornerFold={false} className="mt-4 p-5 sm:px-6">
        <ErrorMessage message={sendError} className="mb-2 text-sm" />
        <InquiryComposer
          onSend={handleSend}
          label={isParticipant ? '主催者へのメッセージ' : '参加者への返信'}
          placeholder={`${inquiry.counterpart_name}さんへの${isParticipant ? 'メッセージ' : '返信'}を書く`}
        />
      </PaperCard>
    </div>
  )
}
