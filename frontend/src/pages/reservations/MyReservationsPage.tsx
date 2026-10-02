import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listMyReservations } from '@/api/reservations'
import { extractErrorMessage } from '@/api/client'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import type { Reservation } from '@/types'
import { formatDateTime } from '@/utils/format'
import { isWorkshopFinished } from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'

// 予約履歴での状態の表示。ワークショップ自体が中止になったものは、予約の状態より中止を優先して伝える
function reservationStatusView(reservation: Reservation): { label: string; className: string } {
  // 参加者は自分でキャンセルできないので、キャンセル済みは主催者がキャンセルしたもの
  if (reservation.status === 'canceled') return { label: '主催者によりキャンセル', className: 'text-slate-400' }
  if (reservation.workshop.status === 'canceled') return { label: 'ワークショップ中止', className: 'font-medium text-red-600' }
  if (isWorkshopFinished(reservation.workshop)) return { label: '参加済み', className: 'text-slate-500' }
  return { label: '予約確定', className: 'text-emerald-600' }
}

// 予約がキャンセルされておらず、ワークショップも中止になっていない
function isActive(reservation: Reservation): boolean {
  return reservation.status !== 'canceled' && reservation.workshop.status !== 'canceled'
}

function startTime(reservation: Reservation): number {
  return new Date(reservation.workshop.start_at).getTime()
}

type Tab = 'upcoming' | 'attended' | 'reservations'

const TAB_OPTIONS: ToggleOption<Tab>[] = [
  { value: 'upcoming', label: '参加予定' },
  { value: 'attended', label: '参加履歴' },
  { value: 'reservations', label: '予約履歴' },
]

const EMPTY_MESSAGE: Record<Tab, string> = {
  upcoming: '参加予定のワークショップはありません。',
  attended: '参加履歴のワークショップはありません。',
  reservations: '予約履歴はありません。',
}

export function MyReservationsPage() {
  const location = useLocation()
  const justReserved = (location.state as { justReserved?: string } | null)?.justReserved
  const [tab, setTab] = useState<Tab>('upcoming')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listMyReservations()
      .then(setReservations)
      .catch((err) => setError(extractErrorMessage(err, '予約一覧の取得に失敗しました')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    switch (tab) {
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
  }, [reservations, tab])

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">参加予定のワークショップ</h1>
      <p className="mt-1 text-sm text-slate-500">
        予約のキャンセルはこの画面からはできません。キャンセルをご希望の場合は、ワークショップの主催者にご連絡ください。
      </p>
      {justReserved && (
        <p role="status" className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          「{justReserved}」への参加登録が完了しました。
        </p>
      )}

      <ToggleGroup
        label="表示する予約"
        hideLabel
        options={TAB_OPTIONS}
        value={tab}
        onChange={setTab}
        className="mt-4"
      />

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      {!loading && filtered.length === 0 && (
        <p className="mt-6 text-slate-500">{EMPTY_MESSAGE[tab]}</p>
      )}
      <ul className="mt-6 space-y-3">
        {filtered.map((reservation) => (
          <li
            key={reservation.id}
            className="relative flex items-center justify-between rounded-lg border border-border-muted bg-white p-4 shadow-sm transition focus-within:ring-2 focus-within:ring-ring hover:shadow-md"
          >
            <div>
              {/* WorkshopCard と同じく、タイトルのリンクの当たり判定(::after)をカード全体に広げる */}
              <Link
                to={`/workshops/${reservation.workshop.id}`}
                className="font-medium text-slate-900 after:absolute after:inset-0 after:rounded-lg focus:outline-none"
              >
                {reservation.workshop.title}
              </Link>
              <p className="text-sm text-slate-500"><WorkshopDateTime start={reservation.workshop.start_at} end={reservation.workshop.end_at} /></p>
              {/* 参加予定は誰の名前で予約したかを、履歴はどの主催者のワークショップかを出す */}
              <p className="text-sm text-slate-500">
                {tab === 'upcoming'
                  ? `参加者: ${reservation.attendee_name}`
                  : `主催者: ${reservation.workshop.facilitator_name}`}
                {` ・ チケット${reservation.ticket_count}枚`}
              </p>
              {/* 参加予定・参加履歴は確定している予約だけなので、状態は予約履歴でだけ出す */}
              {tab === 'reservations' && (
                <p className="text-sm">
                  <span className="text-slate-500">予約日時: {formatDateTime(reservation.created_at)} ・ </span>
                  <span className={reservationStatusView(reservation).className}>
                    {reservationStatusView(reservation).label}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
