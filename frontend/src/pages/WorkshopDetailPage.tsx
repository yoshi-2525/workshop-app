import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getWorkshop } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FavoriteButton } from '../components/FavoriteButton'
import { LocationTypeBadge } from '../components/LocationTypeBadge'
import { NoImage } from '../components/NoImage'
import type { Workshop } from '../types'
import { formatDateTime, formatPrice } from '../utils/format'
import { googleMapsSearchUrl } from '../utils/maps'
import { parseIdParam } from '../utils/params'
import { isWorkshopFull, isWorkshopStarted, priceTextClass } from '../utils/workshop'
import { getLastListUrl } from '../utils/workshopListState'

// 最後に見ていた一覧(検索条件・ページ番号つき)へ戻り、スクロール位置も復元させる
function BackToListLink() {
  return (
    <Link
      to={getLastListUrl()}
      state={{ restoreScroll: true }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 hover:underline"
    >
      <span aria-hidden="true">←</span>
      ワークショップ一覧に戻る
    </Link>
  )
}

export function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  // 画像の読み込みに失敗したときは、画像なしと同じ表示にする
  const [imageFailed, setImageFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 別のワークショップへ遷移したとき、前のデータやエラー・画像の読み込み失敗を残さない
    setWorkshop(null)
    setError(null)
    setImageFailed(false)

    const workshopId = parseIdParam(id)
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    getWorkshop(workshopId, controller.signal)
      .then(setWorkshop)
      .catch((err) => {
        // 遷移で中断された古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [id])

  function handleReserveClick() {
    if (!workshop) return
    if (!user) {
      navigate('/login/participant', { state: { from: `/workshops/${workshop.id}/reserve` } })
      return
    }
    navigate(`/workshops/${workshop.id}/reserve`)
  }

  if (loading)
    return (
      <p role="status" className="text-slate-500">
        読み込み中...
      </p>
    )
  if (error && !workshop)
    return (
      <div>
        <BackToListLink />
        <p role="alert" className="text-red-600">
          {error}
        </p>
      </div>
    )
  if (!workshop) return null

  const isFull = isWorkshopFull(workshop)
  const isStarted = isWorkshopStarted(workshop)

  return (
    <div className="mx-auto max-w-2xl">
      <BackToListLink />
      {workshop.image_url && !imageFailed ? (
        <img
          src={workshop.image_url}
          alt=""
          className="mb-4 aspect-video w-full rounded-lg object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <NoImage className="mb-4 rounded-lg" />
      )}
      {workshop.status === 'canceled' && (
        <p role="status" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          このワークショップは中止になりました。
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{workshop.title}</h1>
        {workshop.status === 'published' && (
          <FavoriteButton workshopId={workshop.id} isFavorited={workshop.viewer.is_favorited} className="mt-1" />
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        主催:{' '}
        <Link to={`/facilitators/${workshop.facilitator_id}`} className="text-slate-700 underline">
          {workshop.facilitator_name}
        </Link>
      </p>
      <dl className="mt-6 space-y-2 rounded-lg border border-border-muted bg-white p-4 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">日時</dt>
          <dd className="text-slate-900">{formatDateTime(workshop.start_at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-medium text-slate-500">場所</dt>
          <dd className="text-slate-900">
            <LocationTypeBadge type={workshop.location_type} className="mr-1.5" />
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
          <dd className={priceTextClass(workshop.price)}>
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

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {workshop.status === 'published' && (
        <>
          <button
            onClick={handleReserveClick}
            disabled={isStarted || isFull || workshop.viewer.is_reserved}
            className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground enabled:hover:bg-accent-hover disabled:opacity-50"
          >
            {workshop.viewer.is_reserved
              ? '予約済みです'
              : isStarted
                ? '開始済みのため予約できません'
                : isFull
                  ? '空席がないため予約できません'
                  : !user
                    ? 'ログインして予約する'
                    : `予約する(${formatPrice(workshop.price)})`}
          </button>
          {workshop.viewer.is_reserved && (
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
