import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listMyReservations } from '../api/reservations'
import { extractErrorMessage } from '../api/client'
import { ToggleGroup, type ToggleOption } from '../components/ToggleGroup'
import type { Reservation } from '../types'
import { isWorkshopFinished } from '../utils/workshop'
import { WorkshopDateTime } from '../components/WorkshopDateTime'

// 予約の状態の表示。ワークショップ自体が中止になったものは、予約の状態より中止を優先して伝える
function reservationStatusView(reservation: Reservation): { label: string; className: string } {
  // 参加者は自分でキャンセルできないので、キャンセル済みは主催者がキャンセルしたもの
  if (reservation.status === 'canceled') return { label: '主催者によりキャンセル', className: 'text-slate-400' }
  if (reservation.workshop.status === 'canceled') return { label: 'ワークショップ中止', className: 'font-medium text-red-600' }
  return { label: '予約確定', className: 'text-emerald-600' }
}

type Tab = 'upcoming' | 'history'

const TAB_OPTIONS: ToggleOption<Tab>[] = [
  { value: 'upcoming', label: '参加予定' },
  { value: 'history', label: '参加履歴' },
]

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
    // 終了日時を過ぎたものを参加履歴にする
    const upcoming = reservations.filter((r) => !isWorkshopFinished(r.workshop))
    const history = reservations.filter((r) => isWorkshopFinished(r.workshop))
    upcoming.sort((a, b) => new Date(a.workshop.start_at).getTime() - new Date(b.workshop.start_at).getTime())
    history.sort((a, b) => new Date(b.workshop.start_at).getTime() - new Date(a.workshop.start_at).getTime())
    return tab === 'upcoming' ? upcoming : history
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
        <p className="mt-6 text-slate-500">
          {tab === 'upcoming' ? '参加予定のワークショップはありません。' : '参加履歴のワークショップはありません。'}
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {filtered.map((reservation) => (
          <li
            key={reservation.id}
            className="flex items-center justify-between rounded-lg border border-border-muted bg-white p-4"
          >
            <div>
              <Link
                to={`/workshops/${reservation.workshop.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {reservation.workshop.title}
              </Link>
              <p className="text-sm text-slate-500"><WorkshopDateTime start={reservation.workshop.start_at} end={reservation.workshop.end_at} /></p>
              <p className="text-sm text-slate-500">
                参加者: {reservation.attendee_name} ・ チケット{reservation.ticket_count}枚
              </p>
              <p className="text-sm">
                <span className={reservationStatusView(reservation).className}>
                  {reservationStatusView(reservation).label}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
