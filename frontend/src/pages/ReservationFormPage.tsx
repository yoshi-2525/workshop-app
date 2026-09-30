import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshop } from '../api/workshops'
import { reserveWorkshop } from '../api/reservations'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatDateTime, formatPrice } from '../utils/format'
import type { Workshop } from '../types'
import { parseIdParam } from '../utils/params'
import { isWorkshopStarted, MAX_TICKETS_PER_RESERVATION, RESERVATION_FIELD_MAX_LENGTH } from '../utils/workshop'

export function ReservationFormPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ログインが必要なページ(ProtectedRoute の内側)なので、表示時点で user は読み込み済み。
  // 初期値として一度だけ入れ、あとから user が更新されても入力中の内容は上書きしない
  const [attendeeName, setAttendeeName] = useState(user?.name ?? '')
  const [contact, setContact] = useState(user?.email ?? '')
  const [ticketCount, setTicketCount] = useState(1)

  const attendeeNameId = useId()
  const contactId = useId()
  const ticketCountId = useId()
  const ticketCountHelpId = useId()

  useEffect(() => {
    const workshopId = parseIdParam(id)
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    getWorkshop(workshopId, controller.signal)
      .then(setWorkshop)
      .catch((err) => {
        // 遷移で中断された古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  function handleCancelClick() {
    if (!workshop) return
    navigate(`/workshops/${workshop.id}`)
  }

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error && !workshop)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    )
  if (!workshop) return null

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
        attendee_name: attendeeName,
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

  if (workshop.status !== 'published') {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-red-600">
          {workshop.status === 'canceled'
            ? 'このワークショップは中止になったため予約できません。'
            : 'このワークショップは公開されていないため予約できません。'}
        </p>
        <Link to={`/workshops/${workshop.id}`} className="mt-4 inline-block text-sm text-slate-600 underline">
          ワークショップ詳細に戻る
        </Link>
      </div>
    )
  }

  if (workshop.viewer.is_reserved) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-slate-600">このワークショップは既に予約済みです。</p>
        <Link to="/reservations" className="mt-4 inline-block text-sm text-slate-600 underline">
          参加予定のワークショップを見る
        </Link>
      </div>
    )
  }

  if (isWorkshopStarted(workshop)) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-red-600">このワークショップは開始済みのため予約できません。</p>
        <Link to={`/workshops/${workshop.id}`} className="mt-4 inline-block text-sm text-slate-600 underline">
          ワークショップ詳細に戻る
        </Link>
      </div>
    )
  }

  if (remaining <= 0) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-red-600">このワークショップは満員のため予約できません。</p>
        <Link to={`/workshops/${workshop.id}`} className="mt-4 inline-block text-sm text-slate-600 underline">
          ワークショップ詳細に戻る
        </Link>
      </div>
    )
  }


  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">参加者情報の入力</h1>
      <div className="mt-4 rounded-lg border border-border-muted bg-white p-4 text-sm">
        <p className="font-semibold text-slate-900">{workshop.title}</p>
        <p className="mt-1 text-slate-500">{formatDateTime(workshop.start_at, 'full')}</p>
        <p className="text-slate-500">
          {workshop.location_type === 'online' ? 'オンライン' : workshop.location}
        </p>
        <p className="mt-1 text-slate-500">残席: {remaining} / {workshop.capacity}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor={attendeeNameId} className="block text-sm font-medium text-slate-700">
            お名前
          </label>
          <input
            id={attendeeNameId}
            autoComplete="name"
            required
            maxLength={RESERVATION_FIELD_MAX_LENGTH}
            value={attendeeName}
            onChange={(e) => setAttendeeName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={contactId} className="block text-sm font-medium text-slate-700">
            連絡先(電話番号・メールアドレスなど)
          </label>
          <input
            id={contactId}
            required
            maxLength={RESERVATION_FIELD_MAX_LENGTH}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="例: 090-1234-5678 または example@mail.com"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={ticketCountId} className="block text-sm font-medium text-slate-700">
            チケット枚数
          </label>
          <select
            id={ticketCountId}
            value={ticketCount}
            onChange={(e) => setTicketCount(Number(e.target.value))}
            aria-describedby={ticketCountHelpId}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
          >
            {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}枚
              </option>
            ))}
          </select>
          <p id={ticketCountHelpId} className="mt-1 text-xs text-slate-500">
            1回の予約で最大{maxTickets}枚まで選択できます。
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">お支払い金額(当日会場にてお支払いください)</span>
            <span className="font-semibold text-slate-900">{formatPrice(totalPrice)}</span>
          </div>
          {workshop.price > 0 && workshop.cancellation_policy && (
            <div className="mt-3 border-t border-border-muted pt-3">
              <p className="text-xs font-semibold text-slate-600">キャンセルポリシー</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{workshop.cancellation_policy}</p>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? '登録中...' : 'この内容で予約を確定する'}
          </button>
          <button
            type="button"
            onClick={handleCancelClick}
            className="rounded-md px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
