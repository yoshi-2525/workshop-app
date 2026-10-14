import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getWorkshop } from '@/api/workshops'
import {
  cancelWorkshopReservation,
  listWorkshopReservations,
  updateReservationAttendance,
} from '@/api/reservations'
import { useApiResource } from '@/hooks/useApiResource'
import type { AttendanceStatus, CancelReason, Reservation, Workshop } from '@/types'
import { ReservationCard } from '@/pages/manage/ReservationCard'
import { parseIdParam } from '@/utils/params'
import { ATTENDANCE_OPEN_HOURS_BEFORE, isAttendanceOpen } from '@/utils/workshop'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  // 取消が済んだことを読み上げる文言
  const [cancelDoneMessage, setCancelDoneMessage] = useState<string | null>(null)

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

  // 失敗したときは例外をそのまま投げ、カードの中にメッセージを出す
  async function handleCancel(reservation: Reservation, reason: CancelReason) {
    // 同じ名前の人を続けて取り消しても読み上げられるよう、いったん空にする
    setCancelDoneMessage(null)
    replaceReservation(await cancelWorkshopReservation(reservation.workshop_id, reservation.id, reason))
    setCancelDoneMessage(`${reservation.user_name}さんの参加をキャンセルしました。`)
  }

  async function handleAttendanceChange(reservation: Reservation, attendance: AttendanceStatus) {
    replaceReservation(await updateReservationAttendance(reservation.workshop_id, reservation.id, attendance))
  }

  // 出欠を記録できる時間になったか(公開中のワークショップだけ)
  const attendanceOpen = workshop.status === 'published' && isAttendanceOpen(workshop)

  const workshopCanceled = workshop.status === 'canceled'
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
      {/* 中止しても予約は確定のまま残るので、参加人数としては数えず、中止の時点の予約として伝える */}
      <p className="mt-1 text-sm text-fg-muted">
        {workshopCanceled ? (
          `このワークショップは中止しました(中止の時点の予約 ${confirmedTickets}名・${confirmed.length}件)`
        ) : (
          <>
            参加人数 {confirmedTickets} / {workshop.capacity}名（予約件数：{confirmed.length}件）
            {pendingTickets > 0 && `・ほかにお支払い待ち ${pendingTickets}名`}
          </>
        )}
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
      {/* 取消の失敗はフォームの中に出す。済んだことはここで読み上げる(フォーカスは予約の名前へ移す) */}
      <p role="status" className="mt-4 text-sm text-fg-secondary empty:hidden">
        {cancelDoneMessage}
      </p>
      {reservations.length === 0 ? (
        <p className="mt-6 text-fg-muted">まだ予約はありません。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              workshop={workshop}
              onCancel={handleCancel}
              onAttendanceChange={handleAttendanceChange}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
