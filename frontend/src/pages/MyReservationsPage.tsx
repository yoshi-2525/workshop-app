import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cancelReservation, listMyReservations } from '../api/reservations'
import { extractErrorMessage } from '../api/client'
import { ToggleGroup, type ToggleOption } from '../components/ToggleGroup'
import type { Reservation } from '../types'
import { formatDateTime } from '../utils/format'
import { isWorkshopFinished, isWorkshopStarted } from '../utils/workshop'

// 予約の状態の表示。ワークショップ自体が中止になったものは、予約の状態より中止を優先して伝える
function reservationStatusView(reservation: Reservation): { label: string; className: string } {
  if (reservation.status === 'canceled') return { label: 'キャンセル済み', className: 'text-slate-400 line-through' }
  if (reservation.workshop.status === 'canceled') return { label: 'ワークショップ中止', className: 'font-medium text-red-600' }
  return { label: '予約確定', className: 'text-emerald-600' }
}

// キャンセルできるのは、確定済みの予約で、ワークショップが中止されておらず、まだ始まっていないものだけ
function canCancel(reservation: Reservation): boolean {
  return (
    reservation.status === 'confirmed' &&
    reservation.workshop.status !== 'canceled' &&
    !isWorkshopStarted(reservation.workshop)
  )
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
  const [cancelingId, setCancelingId] = useState<number | null>(null)

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

  async function handleCancel(reservation: Reservation) {
    const confirmMessage =
      reservation.workshop.price > 0 && reservation.workshop.cancellation_policy
        ? `「${reservation.workshop.title}」の予約を本当にキャンセルしますか?\n\nキャンセルポリシー: ${reservation.workshop.cancellation_policy}`
        : `「${reservation.workshop.title}」の予約を本当にキャンセルしますか?`
    if (!confirm(confirmMessage)) return

    setCancelingId(reservation.id)
    setError(null)
    try {
      await cancelReservation(reservation.id)
      load()
    } catch (err) {
      setError(extractErrorMessage(err, 'キャンセルに失敗しました'))
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">参加予定のワークショップ</h1>
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
              <p className="text-sm text-slate-500">{formatDateTime(reservation.workshop.start_at)}</p>
              <p className="text-sm text-slate-500">
                参加者: {reservation.attendee_name} ・ チケット{reservation.ticket_count}枚
              </p>
              <p className="text-sm">
                <span className={reservationStatusView(reservation).className}>
                  {reservationStatusView(reservation).label}
                </span>
              </p>
            </div>
            {tab === 'upcoming' && canCancel(reservation) && (
              <button
                onClick={() => handleCancel(reservation)}
                disabled={cancelingId === reservation.id}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {cancelingId === reservation.id ? 'キャンセル中...' : 'キャンセル'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
