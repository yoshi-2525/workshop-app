import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getWorkshop } from '@/api/workshops'
import {
  cancelWorkshopReservation,
  listWorkshopReservations,
  updateReservationAttendance,
} from '@/api/reservations'
import { extractErrorMessage } from '@/api/client'
import { useApiResource } from '@/hooks/useApiResource'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import type { AttendanceStatus, Reservation, Workshop } from '@/types'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { ATTENDANCE_OPEN_HOURS_BEFORE, isAttendanceOpen, isWorkshopStarted } from '@/utils/workshop'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'

const ATTENDANCE_OPTIONS: ToggleOption<AttendanceStatus>[] = [
  { value: 'unconfirmed', label: '未確認' },
  { value: 'present', label: '出席' },
  { value: 'absent', label: '欠席' },
]

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState<number | null>(null)

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

  // キャンセルできるのは、確定済みの予約で、ワークショップが中止されておらず、まだ始まっていないものだけ
  // (バックエンドの cancel_workshop_reservation と同じ条件)
  const canCancel = (reservation: Reservation) =>
    reservation.status === 'confirmed' &&
    workshop.status !== 'canceled' &&
    !isWorkshopStarted(workshop)

  // 予約が確定していて、ワークショップも中止になっていない
  const isActive = (reservation: Reservation) =>
    reservation.status === 'confirmed' && workshop.status !== 'canceled'

  async function handleCancel(reservation: Reservation) {
    if (
      !confirm(
        `${reservation.user_name}さんの参加をキャンセルしますか?

` +
          'キャンセルすると参加者に通知が届き、この参加者は同じワークショップを再予約できなくなります。',
      )
    )
      return
    setCancelingId(reservation.id)
    setCancelError(null)
    try {
      const updated = await cancelWorkshopReservation(reservation.workshop_id, reservation.id)
      setData((current) => ({
        ...current,
        reservations: current.reservations.map((r) => (r.id === updated.id ? updated : r)),
      }))
    } catch (err) {
      setCancelError(extractErrorMessage(err, 'キャンセルに失敗しました'))
    } finally {
      setCancelingId(null)
    }
  }

  // 出欠を記録できるのは、公開中のワークショップの確定済みの予約だけ(バックエンドの update_reservation_attendance と同じ条件)
  const attendanceOpen = workshop.status === 'published' && isAttendanceOpen(workshop)

  async function handleAttendanceChange(reservation: Reservation, attendance: AttendanceStatus) {
    if (attendance === reservation.attendance) return
    setUpdatingAttendanceId(reservation.id)
    setAttendanceError(null)
    try {
      const updated = await updateReservationAttendance(reservation.workshop_id, reservation.id, attendance)
      setData((current) => ({
        ...current,
        reservations: current.reservations.map((r) => (r.id === updated.id ? updated : r)),
      }))
    } catch (err) {
      setAttendanceError(extractErrorMessage(err, '出欠の記録に失敗しました'))
    } finally {
      setUpdatingAttendanceId(null)
    }
  }

  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const confirmedTickets = confirmed.reduce((sum, r) => sum + r.ticket_count, 0)
  // 出欠は予約ごとに記録し、人数はその予約のチケット枚数で数える
  const ticketsBy = (attendance: AttendanceStatus) =>
    confirmed.filter((r) => r.attendance === attendance).reduce((sum, r) => sum + r.ticket_count, 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">{workshop.title}の予約状況</h1>
      <p className="mt-1 text-sm text-fg-muted">
        参加人数 {confirmedTickets} / {workshop.capacity}名（予約件数：{confirmed.length}件）
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
      <ErrorMessage message={attendanceError} className="mt-4 text-sm" />
      <ErrorMessage message={cancelError} className="mt-4 text-sm" />
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
                  {/* ワークショップを中止しても予約の状態は確定のまま残る(参加者側で「中止」と区別して伝えるため)ので、
                      表示ではキャンセル済みとして扱う */}
                  <span className={isActive(reservation) ? 'text-emerald-300' : 'text-fg-subtle'}>
                    {isActive(reservation) ? '確定' : 'キャンセル済み'}
                  </span>
                  {canCancel(reservation) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(reservation)}
                      disabled={cancelingId !== null}
                      aria-label={`${reservation.user_name}さんの参加をキャンセル`}
                      className="rounded-md border border-red-400/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {cancelingId === reservation.id ? 'キャンセル中...' : '参加をキャンセル'}
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
              {attendanceOpen && isActive(reservation) && (
                <ToggleGroup
                  label={`${reservation.user_name}さんの出欠`}
                  hideLabel
                  options={ATTENDANCE_OPTIONS}
                  value={reservation.attendance}
                  onChange={(attendance) => handleAttendanceChange(reservation, attendance)}
                  disabled={updatingAttendanceId !== null}
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
