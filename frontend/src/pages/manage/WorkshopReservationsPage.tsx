import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { getWorkshop } from '@/api/workshops'
import { cancelWorkshopReservation, listWorkshopReservations } from '@/api/reservations'
import { extractErrorMessage } from '@/api/client'
import type { Reservation, Workshop } from '@/types'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { isWorkshopStarted } from '@/utils/workshop'

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)

  useEffect(() => {
    const workshopId = parseIdParam(id)
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    Promise.all([getWorkshop(workshopId, controller.signal), listWorkshopReservations(workshopId, controller.signal)])
      .then(([w, r]) => {
        setWorkshop(w)
        setReservations(r)
      })
      .catch((err) => {
        // ページを離れて中断したリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, '取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    )

  // キャンセルできるのは、確定済みの予約で、ワークショップが中止されておらず、まだ始まっていないものだけ
  // (バックエンドの cancel_workshop_reservation と同じ条件)
  const canCancel = (reservation: Reservation) =>
    workshop !== null &&
    reservation.status === 'confirmed' &&
    workshop.status !== 'canceled' &&
    !isWorkshopStarted(workshop)

  // 予約が確定していて、ワークショップも中止になっていない
  const isActive = (reservation: Reservation) =>
    reservation.status === 'confirmed' && workshop?.status !== 'canceled'

  async function handleCancel(reservation: Reservation) {
    if (
      !confirm(
        `${reservation.attendee_name}さんの参加をキャンセルしますか?

` +
          'キャンセルすると参加者に通知が届き、この参加者は同じワークショップを再予約できなくなります。',
      )
    )
      return
    setCancelingId(reservation.id)
    setCancelError(null)
    try {
      const updated = await cancelWorkshopReservation(reservation.workshop_id, reservation.id)
      setReservations((current) => current.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setCancelError(extractErrorMessage(err, 'キャンセルに失敗しました'))
    } finally {
      setCancelingId(null)
    }
  }

  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const confirmedTickets = confirmed.reduce((sum, r) => sum + r.ticket_count, 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{workshop?.title}の予約状況</h1>
      <p className="mt-1 text-sm text-slate-500">
        参加人数 {confirmedTickets} / {workshop?.capacity}名（予約件数：{confirmed.length}件）
      </p>
      {cancelError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {cancelError}
        </p>
      )}
      {reservations.length === 0 ? (
        <p className="mt-6 text-slate-500">まだ予約はありません。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {reservations.map((reservation) => (
            <li
              key={reservation.id}
              className="rounded-lg border border-border-muted bg-white p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{reservation.attendee_name}</span>
                <div className="flex items-center gap-3">
                  {/* ワークショップを中止しても予約の状態は確定のまま残る(参加者側で「中止」と区別して伝えるため)ので、
                      表示ではキャンセル済みとして扱う */}
                  <span className={isActive(reservation) ? 'text-emerald-600' : 'text-slate-400'}>
                    {isActive(reservation) ? '確定' : 'キャンセル済み'}
                  </span>
                  {canCancel(reservation) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(reservation)}
                      disabled={cancelingId !== null}
                      aria-label={`${reservation.attendee_name}さんの参加をキャンセル`}
                      className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelingId === reservation.id ? 'キャンセル中...' : '参加をキャンセル'}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-500">
                <span>
                  メール: {reservation.contact} ・ チケット{reservation.ticket_count}枚
                  {reservation.user_name !== reservation.attendee_name && (
                    <> ・ アカウント: {reservation.user_name}</>
                  )}
                </span>
                <span>{formatDateTime(reservation.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
