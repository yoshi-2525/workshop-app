import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshop } from '@/api/workshops'
import { reserveWorkshop } from '@/api/reservations'
import { extractErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { formatPrice } from '@/utils/format'
import type { Workshop } from '@/types'
import { parseIdParam } from '@/utils/params'
import {
  isReservationClosed,
  RESERVATION_DEADLINE_HOURS_BEFORE,
  isWorkshopStarted,
  MAX_TICKETS_PER_RESERVATION,
  RESERVATION_EMAIL_MAX_LENGTH,
} from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

interface UnavailableReason {
  message: string
  isError: boolean
  // 省略時はワークショップ詳細へ戻るリンク
  link?: { to: string; label: string }
}

// 予約フォームを出せない理由。予約できるなら null
function getUnavailableReason(workshop: Workshop, remaining: number): UnavailableReason | null {
  if (workshop.status !== 'published') {
    return {
      message:
        workshop.status === 'canceled'
          ? 'このワークショップは中止になったため予約できません。'
          : 'このワークショップは公開されていないため予約できません。',
      isError: true,
    }
  }
  if (workshop.viewer.is_reserved) {
    return {
      message: 'このワークショップは既に予約済みです。',
      isError: false,
      link: { to: '/reservations', label: '参加予定のワークショップを見る' },
    }
  }
  if (workshop.viewer.is_reservation_canceled) {
    return { message: '主催者により参加がキャンセルされたため、このワークショップは予約できません。', isError: true }
  }
  if (isWorkshopStarted(workshop)) {
    return { message: 'このワークショップは開始済みのため予約できません。', isError: true }
  }
  if (isReservationClosed(workshop)) {
    return {
      message: `予約の受付は開始日時の${RESERVATION_DEADLINE_HOURS_BEFORE}時間前で締め切りました。`,
      isError: true,
    }
  }
  if (remaining <= 0) {
    return { message: 'このワークショップは満員のため予約できません。', isError: true }
  }
  return null
}

export function ReservationFormPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const workshopId = parseIdParam(id)
  const {
    data: workshop,
    loading,
    error: loadError,
  } = useApiResource(
    workshopId === null ? null : `workshop:${workshopId}`,
    (signal) => getWorkshop(workshopId!, signal),
    'ワークショップの取得に失敗しました',
  )
  // 予約の送信に失敗したときのメッセージ
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ログインが必要なページ(ProtectedRoute の内側)なので、表示時点で user は読み込み済み。
  // 初期値として一度だけ入れ、あとから user が更新されても入力中の内容は上書きしない
  const [contact, setContact] = useState(user?.email ?? '')
  const [ticketCount, setTicketCount] = useState(1)

  const contactId = useId()
  const contactHelpId = useId()
  const ticketCountId = useId()
  const ticketCountHelpId = useId()

  function handleCancelClick() {
    if (!workshop) return
    navigate(`/workshops/${workshop.id}`)
  }

  if (loading) return <LoadingMessage />
  if (!workshop)
    return (
      <ErrorMessage message={loadError ?? 'ワークショップが見つかりませんでした'} />
    )

  const remaining = workshop.capacity - workshop.reserved_count
  const maxTickets = Math.max(1, Math.min(remaining, MAX_TICKETS_PER_RESERVATION))
  const totalPrice = workshop.price * ticketCount

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!workshop) return
    setSubmitting(true)
    setError(null)
    try {
      await reserveWorkshop(workshop.id, {
        contact,
        ticket_count: ticketCount,
      })
      navigate('/reservations', { state: { justReserved: workshop.title } })
    } catch (err) {
      setError(extractErrorMessage(err, '予約に失敗しました'))
    } finally {
      setSubmitting(false)
    }
  }

  // 予約できない場合は、理由と戻り先のリンクだけを出す
  const unavailable = getUnavailableReason(workshop, remaining)
  if (unavailable) {
    const detailLink = { to: `/workshops/${workshop.id}`, label: 'ワークショップ詳細に戻る' }
    const link = unavailable.link ?? detailLink
    return (
      <div className="mx-auto max-w-xl">
        <p className={unavailable.isError ? 'text-red-300' : 'text-fg-secondary'}>{unavailable.message}</p>
        <Link to={link.to} className="mt-4 inline-block text-sm text-fg-secondary underline">
          {link.label}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">参加者情報の入力</h1>
      {/* 予約するワークショップと入力欄を、一覧・詳細のカードと同じ紙の面にまとめる。
          右下の角の折れが予約ボタンにかからないよう、下の余白を広めに取る */}
      <PaperCard className="mt-4 p-4 pb-10 sm:p-6 sm:pb-10">
        <div className="border-b border-border pb-4 text-sm">
          <p className="font-semibold text-fg">{workshop.title}</p>
          <p className="mt-1 text-fg-muted"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} dateStyle="long" /></p>
          <p className="text-fg-muted">
            {workshop.location_type === 'online' ? 'オンライン' : workshop.location}
          </p>
          <p className="mt-1 text-fg-muted">残席: {remaining} / {workshop.capacity}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* 同じアカウントでは同じ名前で参加する想定なので、名前は入力させずアカウント名で予約する */}
          <dl>
            <dt className="text-sm font-medium text-fg-secondary">お名前</dt>
            <dd className="mt-1 text-sm text-fg">{user?.name}</dd>
          </dl>
          <div>
            <label htmlFor={contactId} className="block text-sm font-medium text-fg-secondary">
              メールアドレス
            </label>
            <input
              id={contactId}
              type="email"
              autoComplete="email"
              required
              maxLength={RESERVATION_EMAIL_MAX_LENGTH}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="例: example@mail.com"
              aria-describedby={contactHelpId}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
            <p id={contactHelpId} className="mt-1 text-xs text-fg-muted">
              主催者からの連絡に使います。
            </p>
          </div>
          <div>
            <label htmlFor={ticketCountId} className="block text-sm font-medium text-fg-secondary">
              チケット枚数
            </label>
            <select
              id={ticketCountId}
              value={ticketCount}
              onChange={(e) => setTicketCount(Number(e.target.value))}
              aria-describedby={ticketCountHelpId}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none"
            >
              {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}枚
                </option>
              ))}
            </select>
            <p id={ticketCountHelpId} className="mt-1 text-xs text-fg-muted">
              1回の予約で最大{maxTickets}枚まで選択できます。
            </p>
          </div>

          <div className="rounded-lg bg-surface/70 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-secondary">お支払い金額(当日会場にてお支払いください)</span>
              <span className="font-semibold text-fg">{formatPrice(totalPrice)}</span>
            </div>
            {workshop.price > 0 && workshop.cancellation_policy && (
              <div className="mt-3 border-t border-border-muted pt-3">
                <p className="text-xs font-semibold text-fg-secondary">キャンセルポリシー</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-fg-muted">{workshop.cancellation_policy}</p>
              </div>
            )}
          </div>

          <ErrorMessage message={error} className="text-sm" />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancelClick}
              className="rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-muted"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {submitting ? '登録中...' : 'この内容で予約を確定する'}
            </button>

          </div>
        </form>
      </PaperCard>
    </div>
  )
}
