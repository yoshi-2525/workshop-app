import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getWorkshop } from '../../api/workshops'
import { listWorkshopReservations } from '../../api/reservations'
import { extractErrorMessage } from '../../api/client'
import type { Reservation, Workshop } from '../../types'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
}

export function WorkshopReservationsPage() {
  const { id } = useParams<{ id: string }>()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const workshopId = Number(id)
    Promise.all([getWorkshop(workshopId), listWorkshopReservations(workshopId)])
      .then(([w, r]) => {
        setWorkshop(w)
        setReservations(r)
      })
      .catch((err) => setError(extractErrorMessage(err, '取得に失敗しました')))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error) return <p className="text-red-600">{error}</p>

  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const confirmedTickets = confirmed.reduce((sum, r) => sum + r.ticket_count, 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{workshop?.title} の予約状況</h1>
      <p className="mt-1 text-sm text-slate-500">
        確定チケット数 {confirmedTickets} / {workshop?.capacity}(予約件数 {confirmed.length}件)
      </p>
      <ul className="mt-6 space-y-2">
        {reservations.map((reservation) => (
          <li
            key={reservation.id}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{reservation.attendee_name}</span>
              <span className={reservation.status === 'confirmed' ? 'text-emerald-600' : 'text-slate-400'}>
                {reservation.status === 'confirmed' ? '確定' : 'キャンセル済み'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>
                連絡先: {reservation.contact} ・ チケット{reservation.ticket_count}枚
                {reservation.user_name !== reservation.attendee_name && (
                  <> ・ アカウント: {reservation.user_name}</>
                )}
              </span>
              <span>{formatDateTime(reservation.created_at)}</span>
            </div>
          </li>
        ))}
        {reservations.length === 0 && <p className="text-slate-500">まだ予約はありません。</p>}
      </ul>
    </div>
  )
}
