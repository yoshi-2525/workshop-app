import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getWorkshop } from '@/api/workshops'
import {
  cancelWorkshopReservation,
  listWorkshopReservations,
  updateReservationAttendance,
} from '@/api/reservations'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import type { AttendanceStatus, CancelReason, Reservation, Workshop } from '@/types'
import { paymentStatusLabel } from '@/utils/payment'
import { CancelReservationForm } from '@/pages/manage/CancelReservationForm'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { ATTENDANCE_OPEN_HOURS_BEFORE, isAttendanceOpen, isWorkshopStarted } from '@/utils/workshop'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'
import { DANGER_SMALL_BUTTON_CLASS } from '@/components/ui/styles'

const ATTENDANCE_OPTIONS: ToggleOption<AttendanceStatus>[] = [
  { value: 'unconfirmed', label: '未確認' },
  { value: 'present', label: '出席' },
  { value: 'absent', label: '欠席' },
]

const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  participant: '参加者からの申し出による取消',
  facilitator: '主催者の都合による取消',
}

// 予約ごとのオンライン決済の状態と、取り消したときの理由
function PaymentAndReasonLine({ reservation }: { reservation: Reservation }) {
  const payment = paymentStatusLabel(reservation.payment)
  // 理由は、参加を取り消した予約にだけ出す(中止のときは中止の表示で分かる)
  const reason = reservation.status === 'canceled' && reservation.cancel_reason ? CANCEL_REASON_LABEL[reservation.cancel_reason] : null
  if (!payment && !reason) return null
  return <p className="mt-1 text-fg-muted">{[payment, reason].filter(Boolean).join(' ・ ')}</p>
}

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  // どちらも実行中の予約の ID を持つ
  const cancelAction = useAsyncAction<number>()
  const attendanceAction = useAsyncAction<number>()
  // 取消のフォームを開いている予約
  const [cancelingId, setCancelingId] = useState<number | null>(null)
  // 取消が済んだことを読み上げる文言
  const [cancelDoneMessage, setCancelDoneMessage] = useState<string | null>(null)
  // フォームを閉じたら、開いたボタンへフォーカスを戻す
  const cancelTriggerRefs = useRef(new Map<number, HTMLButtonElement>())

  const workshopId = parseIdParam(id)
  const { data, loading, error, setData } = useApiResource(
    workshopId === null ? null : `workshop-reservations:${workshopId}`,
    async (signal): Promise<{ workshop: Workshop; reservations: Reservation[] }> => {
      const [workshop, reservations] = await Promise.all([
        getWorkshop(workshopId!, signal),
        listWorkshopReservations(workshopId!, signal),
      ])
      return { workshop, reservations }
    },
    '取得に失敗しました',
  )

  if (loading) return <LoadingMessage />
  if (workshopId === null || error || !data)
    return (
      <ErrorMessage message={error ?? 'ワークショップが見つかりませんでした'} />
    )
  const { workshop, reservations } = data

  // 操作の結果で返ってきた予約を、一覧に反映する
  function replaceReservation(updated: Reservation) {
    setData((current) => ({
      ...current,
      reservations: current.reservations.map((r) => (r.id === updated.id ? updated : r)),
    }))
  }

  // キャンセルできるのは、確定済みの予約で、ワークショップが中止されておらず、まだ始まっていないものだけ
  // (バックエンドの cancel_workshop_reservation と同じ条件)
  const canCancel = (reservation: Reservation) =>
    reservation.status === 'confirmed' &&
    workshop.status !== 'canceled' &&
    !isWorkshopStarted(workshop)

  // 予約が確定していて、ワークショップも中止になっていない
  const isActive = (reservation: Reservation) =>
    reservation.status === 'confirmed' && workshop.status !== 'canceled'

  async function handleCancel(reservation: Reservation, reason: CancelReason) {
    const result = await cancelAction.run(
      () => cancelWorkshopReservation(reservation.workshop_id, reservation.id, reason),
      'キャンセルに失敗しました',
      reservation.id,
    )
    if (result.ok) {
      replaceReservation(result.value)
      setCancelingId(null)
      setCancelDoneMessage(`${reservation.user_name}さんの参加をキャンセルしました。`)
    }
  }

  function openCancelForm(reservationId: number) {
    // 別の予約で失敗したときのメッセージを持ち越さない
    cancelAction.clearError()
    setCancelDoneMessage(null)
    setCancelingId(reservationId)
  }

  function closeCancelForm(reservationId: number) {
    cancelAction.clearError()
    setCancelingId(null)
    cancelTriggerRefs.current.get(reservationId)?.focus()
  }

  // 出欠を記録できるのは、公開中のワークショップの確定済みの予約だけ(バックエンドの update_reservation_attendance と同じ条件)
  const attendanceOpen = workshop.status === 'published' && isAttendanceOpen(workshop)

  async function handleAttendanceChange(reservation: Reservation, attendance: AttendanceStatus) {
    if (attendance === reservation.attendance) return
    const result = await attendanceAction.run(
      () => updateReservationAttendance(reservation.workshop_id, reservation.id, attendance),
      '出欠の記録に失敗しました',
      reservation.id,
    )
    if (result.ok) replaceReservation(result.value)
  }

  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const confirmedTickets = confirmed.reduce((sum, r) => sum + r.ticket_count, 0)
  // 支払い待ちも席を確保しているので、残席の表示と数が合うよう別に添える
  const pendingTickets = reservations
    .filter((r) => r.status === 'pending_payment')
    .reduce((sum, r) => sum + r.ticket_count, 0)
  // 出欠は予約ごとに記録し、人数はその予約のチケット枚数で数える
  const ticketsBy = (attendance: AttendanceStatus) =>
    confirmed.filter((r) => r.attendance === attendance).reduce((sum, r) => sum + r.ticket_count, 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">{workshop.title}の予約状況</h1>
      <p className="mt-1 text-sm text-fg-muted">
        参加人数 {confirmedTickets} / {workshop.capacity}名（予約件数：{confirmed.length}件）
        {pendingTickets > 0 && `・ほかにお支払い待ち ${pendingTickets}名`}
      </p>
      {workshop.status === 'published' && confirmed.length > 0 && (
        <PaperCard cornerFold={false} className="mt-4 p-3 text-sm">
          <h2 className="font-semibold text-fg">出欠確認</h2>
          {attendanceOpen ? (
            <p className="mt-1 text-fg-muted" aria-live="polite">
              <span className="text-emerald-300">出席 {ticketsBy('present')}名</span> ・{' '}
              <span className="text-red-300">欠席 {ticketsBy('absent')}名</span> ・ 未確認 {ticketsBy('unconfirmed')}名
            </p>
          ) : (
            <p className="mt-1 text-fg-muted">
              出欠は開始日時の{ATTENDANCE_OPEN_HOURS_BEFORE}時間前から、各予約の「出欠」で記録できます。
            </p>
          )}
        </PaperCard>
      )}
      <ErrorMessage message={attendanceAction.error} className="mt-4 text-sm" />
      {/* 取消の失敗はフォームの中に出す。済んだことはここで読み上げる(フォームが閉じてフォーカスの行き先がなくなるため) */}
      <p role="status" className="mt-4 text-sm text-fg-secondary empty:hidden">
        {cancelDoneMessage}
      </p>
      {reservations.length === 0 ? (
        <p className="mt-6 text-fg-muted">まだ予約はありません。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {reservations.map((reservation) => (
            <PaperCard
              as="li"
              key={reservation.id}
              cornerFold={false}
              className="p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg">{reservation.user_name}</span>
                <div className="flex items-center gap-3">
                  {/* 支払い待ちは、期限までに支払われなければ自動で席が空く */}
                  {reservation.status === 'pending_payment' && workshop.status !== 'canceled' ? (
                    <span className="text-fg-muted">お支払い待ち</span>
                  ) : (
                    // ワークショップを中止しても予約の状態は確定のまま残る(参加者側で「中止」と区別して伝えるため)ので、
                    // 表示ではキャンセル済みとして扱う
                    <span className={isActive(reservation) ? 'text-emerald-300' : 'text-fg-subtle'}>
                      {isActive(reservation) ? '確定' : 'キャンセル済み'}
                    </span>
                  )}
                  {canCancel(reservation) && (
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) cancelTriggerRefs.current.set(reservation.id, el)
                        else cancelTriggerRefs.current.delete(reservation.id)
                      }}
                      onClick={() =>
                        cancelingId === reservation.id ? closeCancelForm(reservation.id) : openCancelForm(reservation.id)
                      }
                      disabled={cancelAction.pending}
                      aria-label={`${reservation.user_name}さんの参加をキャンセル`}
                      aria-expanded={cancelingId === reservation.id}
                      aria-controls={cancelingId === reservation.id ? `cancel-form-${reservation.id}` : undefined}
                      className={DANGER_SMALL_BUTTON_CLASS}
                    >
                      参加をキャンセル
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-fg-muted">
                <span>
                  メール: {reservation.contact} ・ チケット{reservation.ticket_count}枚
                </span>
                <span>{formatDateTime(reservation.created_at)}</span>
              </div>
              <PaymentAndReasonLine reservation={reservation} />
              {cancelingId === reservation.id && (
                <CancelReservationForm
                  id={`cancel-form-${reservation.id}`}
                  reservation={reservation}
                  pending={cancelAction.pendingKey === reservation.id}
                  error={cancelAction.error}
                  onConfirm={(reason) => handleCancel(reservation, reason)}
                  onClose={() => closeCancelForm(reservation.id)}
                />
              )}
              {attendanceOpen && isActive(reservation) && (
                <ToggleGroup
                  label={`${reservation.user_name}さんの出欠`}
                  hideLabel
                  options={ATTENDANCE_OPTIONS}
                  value={reservation.attendance}
                  onChange={(attendance) => handleAttendanceChange(reservation, attendance)}
                  disabled={attendanceAction.pending}
                  className="mt-2"
                />
              )}
            </PaperCard>
          ))}
        </ul>
      )}
    </div>
  )
}
