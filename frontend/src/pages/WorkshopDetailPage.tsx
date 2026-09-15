import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshop } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FavoriteButton } from '../components/FavoriteButton'
import type { Workshop } from '../types'
import { formatPrice } from '../utils/format'
import { googleMapsSearchUrl } from '../utils/maps'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', { dateStyle: 'full', timeStyle: 'short' })
}

export function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getWorkshop(Number(id))
      .then(setWorkshop)
      .catch((err) => setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました')))
      .finally(() => setLoading(false))
  }, [id])

  function handleReserveClick() {
    if (!workshop) return
    if (!user) {
      navigate('/login/participant', { state: { from: `/workshops/${workshop.id}/reserve` } })
      return
    }
    navigate(`/workshops/${workshop.id}/reserve`)
  }

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error && !workshop) return <p className="text-red-600">{error}</p>
  if (!workshop) return null

  const isFull = workshop.reserved_count >= workshop.capacity

  return (
    <div className="mx-auto max-w-2xl">
      {workshop.image_url && (
        <img
          src={workshop.image_url}
          alt=""
          className="mb-4 h-64 w-full rounded-lg object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{workshop.title}</h1>
        <FavoriteButton workshopId={workshop.id} isFavorited={workshop.is_favorited} className="mt-1" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        主催:{' '}
        <Link to={`/facilitators/${workshop.facilitator_id}`} className="text-slate-700 underline">
          {workshop.facilitator_name}
        </Link>
      </p>
      <dl className="mt-6 space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">日時</dt>
          <dd className="text-slate-900">{formatDateTime(workshop.start_at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">場所</dt>
          <dd className="text-slate-900">
            <span
              className={`mr-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                workshop.location_type === 'online'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {workshop.location_type === 'online' ? 'オンライン' : '会場'}
            </span>
            {workshop.location}
            {workshop.location_type === 'offline' && (
              <a
                href={googleMapsSearchUrl(workshop.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-xs text-slate-500 underline hover:text-slate-700"
              >
                地図で見る
              </a>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">参加費</dt>
          <dd className={workshop.price > 0 ? 'font-semibold text-slate-900' : 'font-semibold text-emerald-600'}>
            {formatPrice(workshop.price)}
            {workshop.price > 0 && <span className="ml-1 text-xs font-normal text-slate-500">(当日会場にてお支払いください)</span>}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">定員</dt>
          <dd className={isFull ? 'font-semibold text-red-600' : 'text-slate-900'}>
            {workshop.reserved_count} / {workshop.capacity}
            {isFull ? '(満員)' : ''}
          </dd>
        </div>
      </dl>
      <p className="mt-6 whitespace-pre-wrap text-slate-700">{workshop.description}</p>

      {workshop.price > 0 && workshop.cancellation_policy && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">キャンセルポリシー</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">{workshop.cancellation_policy}</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {workshop.status === 'published' && (
        <>
          <button
            onClick={handleReserveClick}
            disabled={isFull || workshop.is_reserved}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:opacity-50"
          >
            {isFull
              ? '満員です'
              : !user
                ? 'ログインして予約する'
                : workshop.is_reserved
                  ? '予約済みです'
                  : `予約する(${formatPrice(workshop.price)})`}
          </button>
          {workshop.is_reserved && (
            <p className="mt-2 text-sm text-slate-500">
              このワークショップは予約済みです。内容の確認・キャンセルは{' '}
              <Link to="/reservations" className="underline">
                参加予定のワークショップ
              </Link>{' '}
              から行えます。
            </p>
          )}
        </>
      )}
    </div>
  )
}
