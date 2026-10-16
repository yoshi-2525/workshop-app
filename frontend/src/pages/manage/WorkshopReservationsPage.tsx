import { useId, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { formatDateTime } from '@/utils/format'
import { ATTENDANCE_OPEN_HOURS_BEFORE, isAttendanceOpen } from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { SECONDARY_SMALL_BUTTON_CLASS } from '@/components/ui/styles'

const HOUR_MS = 60 * 60 * 1000

// 予約状況の上にまとめて並べる、数字を大きく見せる暗い面のパネル
function SummaryPanel({ heading, children }: { heading: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="rounded-lg bg-surface-muted p-4 shadow-card sm:p-5">
      <h2 id={headingId} className="text-sm font-medium text-fg-muted">
        {heading}
      </h2>
      {children}
    </section>
  )
}

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  const listHeadingId = useId()
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
  // 出欠を記録できるようになる日時。まだのときに、いつから記録できるかを添える
  const attendanceOpensAt = new Date(new Date(workshop.start_at).getTime() - ATTENDANCE_OPEN_HOURS_BEFORE * HOUR_MS)

  const workshopCanceled = workshop.status === 'canceled'
  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const confirmedTickets = confirmed.reduce((sum, r) => sum + r.ticket_count, 0)
  // 支払い待ちも席を確保しているので、残席の表示と数が合うよう別に添える
  const pendingTickets = reservations
    .filter((r) => r.status === 'pending_payment')
    .reduce((sum, r) => sum + r.ticket_count, 0)
  const remainingSeats = Math.max(workshop.capacity - confirmedTickets - pendingTickets, 0)
  // 定員に対する参加人数の割合(バーの長さ)。定員を超えて見えないよう 100% で止める
  const filledPercent = workshop.capacity > 0 ? Math.min((confirmedTickets / workshop.capacity) * 100, 100) : 0
  // 出欠は予約ごとに記録し、人数はその予約のチケット枚数で数える
  const ticketsBy = (attendance: AttendanceStatus) =>
    confirmed.filter((r) => r.attendance === attendance).reduce((sum, r) => sum + r.ticket_count, 0)

  return (
    <div>
      <Breadcrumb />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">予約状況</p>
          <h1 className="mt-1 break-words text-xl font-semibold text-fg sm:text-2xl">{workshop.title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-secondary">
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="schedule" className="text-[18px] text-fg-subtle" />
              <WorkshopDateTime start={workshop.start_at} end={workshop.end_at} />
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MaterialIcon name="location_on" className="text-[18px] text-fg-subtle" />
              <span className="break-all">
                {workshop.location_type === 'online' ? `オンライン(${workshop.location})` : workshop.location}
              </span>
            </span>
          </p>
        </div>
        {/* 下書きは参加者に公開されておらず、問い合わせも受けないので出さない */}
        {workshop.status !== 'draft' && (
          <Link
            to={`/inquiries?workshop_id=${workshop.id}`}
            aria-label={`${workshop.title}への問い合わせ・お知らせ`}
            className={SECONDARY_SMALL_BUTTON_CLASS}
          >
            <MaterialIcon name="chat" className="text-[18px]" />
            問い合わせ・お知らせ
          </Link>
        )}
      </div>

      {workshopCanceled ? (
        // 中止しても予約は確定のまま残るので、参加人数としては数えず、中止の時点の予約として伝える
        <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm text-fg-secondary shadow-card">
          このワークショップは中止しました(中止の時点の予約 {confirmedTickets}名・{confirmed.length}件)
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          <SummaryPanel heading="参加人数">
            <p className="mt-2 text-3xl font-semibold tabular-nums text-fg">
              {confirmedTickets}
              <span className="text-base font-normal text-fg-muted"> / {workshop.capacity}名</span>
            </p>
            <div aria-hidden="true" className="mt-3 h-1.5 rounded-full bg-surface-strong">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${filledPercent}%` }} />
            </div>
            <p className="mt-2 text-sm text-fg-muted">
              残り{remainingSeats}席
              {pendingTickets > 0 && `・ほかにお支払い待ち ${pendingTickets}名`}
            </p>
          </SummaryPanel>

          <SummaryPanel heading="予約件数">
            <p className="mt-2 text-3xl font-semibold tabular-nums text-fg">
              {confirmed.length}
              <span className="text-base font-normal text-fg-muted">件</span>
            </p>
          </SummaryPanel>

          {workshop.status === 'published' && confirmed.length > 0 && (
            <SummaryPanel heading="出欠確認">
              {attendanceOpen ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums" aria-live="polite">
                  <span className="text-emerald-300">出席 {ticketsBy('present')}名</span>
                  <span className="text-red-300">欠席 {ticketsBy('absent')}名</span>
                  <span className="text-fg-secondary">未確認 {ticketsBy('unconfirmed')}名</span>
                </p>
              ) : (
                <>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-fg-secondary">
                    <MaterialIcon name="schedule" className="text-[18px] text-accent" />
                    開始の{ATTENDANCE_OPEN_HOURS_BEFORE}時間前から
                  </p>
                  <p className="mt-2 text-sm text-fg-muted">
                    {formatDateTime(attendanceOpensAt.toISOString())}から、各予約の「出欠」で記録できます。
                  </p>
                </>
              )}
            </SummaryPanel>
          )}
        </div>
      )}

      <section aria-labelledby={listHeadingId} className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id={listHeadingId} className="text-base font-semibold text-fg-secondary">
            予約一覧
          </h2>
          {reservations.length > 0 && <span className="text-sm text-fg-muted">{reservations.length}件</span>}
        </div>
        {/* 取消の失敗はフォームの中に出す。済んだことはここで読み上げる(フォーカスは予約の名前へ移す) */}
        <p role="status" className="mb-3 text-sm text-fg-secondary empty:hidden">
          {cancelDoneMessage}
        </p>
        {reservations.length === 0 ? (
          <p className="text-fg-muted">まだ予約はありません。</p>
        ) : (
          <ul className="divide-y divide-border-muted overflow-hidden rounded-lg bg-surface-muted shadow-card">
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
      </section>
    </div>
  )
}
