import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listMyReservations } from '@/api/reservations'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { useApiResource } from '@/hooks/useApiResource'
import type { Reservation } from '@/types'
import { formatDateTime } from '@/utils/format'
import { isWorkshopFinished } from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'

// 予約履歴での状態の表示。ワークショップ自体が中止になったものは、予約の状態より中止を優先して伝える
function reservationStatusView(reservation: Reservation): { label: string; className: string } {
  // 参加者は自分でキャンセルできないので、キャンセル済みは主催者がキャンセルしたもの
  if (reservation.status === 'canceled') return { label: '主催者によりキャンセル', className: 'text-fg-subtle' }
  if (reservation.workshop.status === 'canceled') return { label: '主催者により中止', className: 'font-medium text-red-300' }
  if (isWorkshopFinished(reservation.workshop)) return { label: '参加済み', className: 'text-fg-muted' }
  return { label: '予約確定', className: 'text-emerald-300' }
}

// 予約がキャンセルされておらず、ワークショップも中止になっていない
function isActive(reservation: Reservation): boolean {
  return reservation.status !== 'canceled' && reservation.workshop.status !== 'canceled'
}

function startTime(reservation: Reservation): number {
  return new Date(reservation.workshop.start_at).getTime()
}

// 予約・参加履歴ページのタブ
type HistoryTab = 'attended' | 'reservations'

const HISTORY_TAB_OPTIONS: ToggleOption<HistoryTab>[] = [
  { value: 'attended', label: '参加履歴' },
  { value: 'reservations', label: '予約履歴' },
]

// 一覧の種類。参加予定は「参加予定のワークショップ」ページ、残りは「予約・参加履歴」ページのタブ
type ListKind = 'upcoming' | HistoryTab

const EMPTY_MESSAGE: Record<ListKind, string> = {
  upcoming: 'いまは参加予定の場はありません。気が向いたときに、のぞいてみてください。',
  attended: 'まだ参加した場はありません。最初の一回は、聞いているだけでも大丈夫です。',
  reservations: '予約履歴はありません。',
}

function filterReservations(reservations: Reservation[], kind: ListKind): Reservation[] {
  switch (kind) {
    // 参加予定・参加履歴は確定している予約だけ。終了日時を過ぎたかどうかで振り分ける
    case 'upcoming':
      return reservations
        .filter((r) => isActive(r) && !isWorkshopFinished(r.workshop))
        .sort((a, b) => startTime(a) - startTime(b))
    case 'attended':
      return reservations
        .filter((r) => isActive(r) && isWorkshopFinished(r.workshop))
        .sort((a, b) => startTime(b) - startTime(a))
    // 予約履歴はキャンセル・中止も含めたすべての予約を、予約した日時の新しい順に並べる
    case 'reservations':
      return [...reservations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
  }
}

// 自分の予約を取得して、指定した種類の一覧を表示する(読み込み中・エラー・0件の表示も含む)
function ReservationList({ kind }: { kind: ListKind }) {
  const { data, loading, error } = useApiResource('my-reservations', listMyReservations, '予約一覧の取得に失敗しました')
  const filtered = useMemo(() => filterReservations(data ?? [], kind), [data, kind])

  return (
    <>
      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {!loading && filtered.length === 0 && (
        <p className="mt-6 text-fg-muted">{EMPTY_MESSAGE[kind]}</p>
      )}
      <ul className="mt-6 space-y-3">
        {filtered.map((reservation) => (
          <PaperCard
            as="li"
            key={reservation.id}
            cornerFold={false}
            interactive
            className="flex items-center justify-between p-4"
          >
            <div>
              {/* WorkshopCard と同じく、タイトルのリンクの当たり判定(::after)をカード全体に広げる */}
              <Link
                to={`/workshops/${reservation.workshop.id}`}
                className="font-medium text-fg after:absolute after:inset-0 after:rounded-lg focus:outline-none"
              >
                {reservation.workshop.title}
              </Link>
              <p className="text-sm text-fg-muted"><WorkshopDateTime start={reservation.workshop.start_at} end={reservation.workshop.end_at} /></p>
              {/* 同じアカウントでは同じ名前で参加する想定なので、参加者名は出さず、どの主催者のワークショップかを出す */}
              <p className="text-sm text-fg-muted">
                {`主催者: ${reservation.workshop.facilitator_name} ・ チケット${reservation.ticket_count}枚`}
              </p>
              {/* 参加予定・参加履歴は確定している予約だけなので、状態は予約履歴でだけ出す */}
              {kind === 'reservations' && (
                <p className="text-sm">
                  <span className="text-fg-muted">予約日時: {formatDateTime(reservation.created_at)} ・ </span>
                  <span className={reservationStatusView(reservation).className}>
                    {reservationStatusView(reservation).label}
                  </span>
                </p>
              )}
            </div>
          </PaperCard>
        ))}
      </ul>
    </>
  )
}

// 参加予定のワークショップ(/reservations)。予約の完了後もここに移動して、完了メッセージを出す
export function MyReservationsPage() {
  const location = useLocation()
  const justReserved = (location.state as { justReserved?: string } | null)?.justReserved

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">参加予定のワークショップ</h1>
      <p className="mt-1 text-sm text-fg-muted">
        予約のキャンセルはこの画面からはできません。キャンセルをご希望の場合は、ワークショップの主催者にご連絡ください。
      </p>
      {justReserved && (
        <p role="status" className="mt-4 rounded-md bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          「{justReserved}」への参加登録が完了しました。
        </p>
      )}
      <ReservationList kind="upcoming" />
    </div>
  )
}

// 予約・参加履歴(/reservations/history)。参加済みのワークショップと、キャンセル・中止も含めた予約の履歴をタブで切り替える
export function ReservationHistoryPage() {
  const [tab, setTab] = useState<HistoryTab>('attended')

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">予約・参加履歴</h1>
      <ToggleGroup
        label="表示する履歴"
        hideLabel
        options={HISTORY_TAB_OPTIONS}
        value={tab}
        onChange={setTab}
        className="mt-4"
      />
      <ReservationList kind={tab} />
    </div>
  )
}
