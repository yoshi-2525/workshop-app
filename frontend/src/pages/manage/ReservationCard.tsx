import { useId, useRef, useState } from 'react'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import type { AttendanceStatus, CancelReason, Reservation, Workshop } from '@/types'
import { paymentStatusLabel } from '@/utils/payment'
import { CancelReservationForm } from '@/pages/manage/CancelReservationForm'
import { formatDateTime } from '@/utils/format'
import { isAttendanceOpen, isWorkshopStarted } from '@/utils/workshop'
import { ErrorMessage } from '@/components/ui/StatusMessage'
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

interface ReservationCardProps {
  reservation: Reservation
  workshop: Workshop
  // どちらも API を呼んで一覧に反映する。失敗したら例外を投げ、メッセージはカードの中に出す
  onCancel: (reservation: Reservation, reason: CancelReason) => Promise<void>
  onAttendanceChange: (reservation: Reservation, attendance: AttendanceStatus) => Promise<void>
}

// 主催者の予約状況の画面に並べる、予約1件のカード。取消のフォームと出欠の記録もここで扱う
export function ReservationCard({ reservation, workshop, onCancel, onAttendanceChange }: ReservationCardProps) {
  const cancelAction = useAsyncAction()
  const attendanceAction = useAsyncAction()
  const [cancelFormOpen, setCancelFormOpen] = useState(false)
  const cancelFormId = useId()
  // フォームを閉じたら、開いたボタンへフォーカスを戻す
  const cancelTriggerRef = useRef<HTMLButtonElement>(null)
  // 取消が済むとボタンもフォームも消えるので、名前へフォーカスを移して一覧での位置を保つ
  const nameRef = useRef<HTMLSpanElement>(null)

  const workshopCanceled = workshop.status === 'canceled'
  // 予約が確定していて、ワークショップも中止になっていない
  const active = reservation.status === 'confirmed' && !workshopCanceled
  // キャンセルできるのは、確定済みの予約で、ワークショップが中止されておらず、まだ始まっていないものだけ
  // (バックエンドの cancel_workshop_reservation と同じ条件)
  const canCancel = active && !isWorkshopStarted(workshop)
  // 出欠を記録できるのは、公開中のワークショップの確定済みの予約だけ(バックエンドの update_reservation_attendance と同じ条件)
  const attendanceOpen = active && workshop.status === 'published' && isAttendanceOpen(workshop)

  function openCancelForm() {
    cancelAction.clearError()
    setCancelFormOpen(true)
  }

  function closeCancelForm() {
    cancelAction.clearError()
    setCancelFormOpen(false)
    cancelTriggerRef.current?.focus()
  }

  async function handleConfirmCancel(reason: CancelReason) {
    const result = await cancelAction.run(() => onCancel(reservation, reason), 'キャンセルに失敗しました')
    if (result.ok) {
      setCancelFormOpen(false)
      nameRef.current?.focus()
    }
  }

  function handleAttendanceChange(attendance: AttendanceStatus) {
    if (attendance === reservation.attendance) return
    void attendanceAction.run(() => onAttendanceChange(reservation, attendance), '出欠の記録に失敗しました')
  }

  return (
    <PaperCard as="li" cornerFold={false} className="p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span ref={nameRef} tabIndex={-1} className="min-w-0 break-all font-medium text-fg focus:outline-none">
          {reservation.user_name}
        </span>
        <div className="flex items-center gap-3">
          {/* 支払い待ちは、期限までに支払われなければ自動で席が空く */}
          {reservation.status === 'pending_payment' && !workshopCanceled ? (
            <span className="text-fg-muted">お支払い待ち</span>
          ) : (
            // ワークショップを中止しても予約の状態は確定のまま残る(参加者側で「中止」と区別して伝えるため)ので、
            // 表示ではキャンセル済みとして扱う
            <span className={active ? 'text-emerald-300' : 'text-fg-subtle'}>{active ? '確定' : 'キャンセル済み'}</span>
          )}
          {canCancel && (
            <button
              type="button"
              ref={cancelTriggerRef}
              onClick={() => (cancelFormOpen ? closeCancelForm() : openCancelForm())}
              disabled={cancelAction.pending}
              aria-label={`${reservation.user_name}さんの参加をキャンセル`}
              aria-expanded={cancelFormOpen}
              aria-controls={cancelFormOpen ? cancelFormId : undefined}
              className={DANGER_SMALL_BUTTON_CLASS}
            >
              参加をキャンセル
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-fg-muted">
        <span className="min-w-0 break-all">
          メール: {reservation.contact} ・ チケット{reservation.ticket_count}枚
        </span>
        <span>{formatDateTime(reservation.created_at)}</span>
      </div>
      <PaymentAndReasonLine reservation={reservation} />
      {cancelFormOpen && (
        <CancelReservationForm
          id={cancelFormId}
          reservation={reservation}
          pending={cancelAction.pending}
          error={cancelAction.error}
          onConfirm={handleConfirmCancel}
          onClose={closeCancelForm}
        />
      )}
      {attendanceOpen && (
        <ToggleGroup
          label={`${reservation.user_name}さんの出欠`}
          hideLabel
          options={ATTENDANCE_OPTIONS}
          value={reservation.attendance}
          onChange={handleAttendanceChange}
          disabled={attendanceAction.pending}
          className="mt-2"
        />
      )}
      <ErrorMessage message={attendanceAction.error} className="mt-1 text-xs" />
    </PaperCard>
  )
}
