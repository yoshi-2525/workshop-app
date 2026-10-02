import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRelatedWorkshops, getWorkshop } from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { FavoriteButton } from '@/components/workshop/FavoriteButton'
import { LocationTypeBadge } from '@/components/workshop/LocationTypeBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { NoImage } from '@/components/ui/NoImage'
import { RelatedWorkshopSection } from '@/components/workshop/RelatedWorkshopSection'
import { ShareButton } from '@/components/workshop/ShareButton'
import type { RelatedWorkshops, Workshop } from '@/types'
import { FewSeatsBadge, FullBadge } from '@/components/workshop/SeatStatusBadge'
import { formatPriceYen } from '@/utils/format'
import { googleMapsSearchUrl } from '@/utils/maps'
import { parseIdParam } from '@/utils/params'
import { isWorkshopFull, isWorkshopStarted, priceTextClass } from '@/utils/workshop'
import { getLastListUrl } from '@/utils/workshopListState'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'

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

  // 関連するワークショップは本体とは別に読み込む。本体の表示を待たせないよう、失敗しても欄を出さないだけにする
  const [related, setRelated] = useState<RelatedWorkshops | null>(null)
  useEffect(() => {
    setRelated(null)
    const workshopId = parseIdParam(id)
    if (workshopId === null) return
    const controller = new AbortController()
    getRelatedWorkshops(workshopId, controller.signal)
      .then(setRelated)
      .catch(() => {
        // 関連の欄は補助的な情報なので、取得に失敗しても何も表示しない
      })
    return () => controller.abort()
  }, [id])

  function handleInquiryClick() {
    if (!workshop) return
    const path = `/workshops/${workshop.id}/inquiry`
    if (!user) {
      navigate('/login/participant', { state: { from: path } })
      return
    }
    navigate(path)
  }

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
  // 満員・残席僅かは予約を受け付けている(公開中で開始前の)ときだけ意味があるので、それ以外は出さない
  const showSeatStatus = workshop.status === 'published' && !isStarted
  const isOwnWorkshop = user?.id === workshop.facilitator_id

  return (
    <div className="mx-auto max-w-3xl">
      <BackToListLink />
      {/* 画像から説明文までを1枚のカードにまとめる */}
      <div className="rounded-lg border border-border-muted bg-white p-4 sm:p-6">
        {workshop.image_url && !imageFailed ? (
          <img
            src={workshop.image_url}
            alt=""
            className="mx-auto mb-4 aspect-video w-full max-w-xl rounded-md object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <NoImage className="mx-auto mb-4 max-w-xl rounded-md" />
        )}
        {workshop.status === 'canceled' && (
          <p role="status" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            このワークショップは中止になりました。
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {/* 満員はタイトルの横に出す(残席僅かは定員の右) */}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{workshop.title}</h1>
            {showSeatStatus && <FullBadge workshop={workshop} />}
          </div>
          {/* 共有とお気に入りは、それぞれ薄いグレーの丸で囲む */}
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <ShareButton path={`/workshops/${workshop.id}`} title={workshop.title} className="rounded-full bg-slate-50" />
            {workshop.status === 'published' && (
              <FavoriteButton
                workshopId={workshop.id}
                isFavorited={workshop.viewer.is_favorited}
                size="lg"
                className="rounded-full bg-slate-50"
              />
            )}
          </div>
        </div>
        {/* アイコンと名前をまとめて主催者ページへのリンクにする */}
        <div className="py-4 flex items-center gap-2 text-sm text-slate-500">
          <p className="flex items-center gap-2 text-base">
            主催者:
            <Link
              to={`/facilitators/${workshop.facilitator_id}`}
              className="flex items-center gap-2 text-slate-700 underline"
            >
              <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} className="h-8 w-8 text-sm" />
              {workshop.facilitator_name}
            </Link>
          </p>
          {/* 自分のワークショップなら届いた問い合わせへ、そうでなければ主催者への問い合わせへ。下書きは問い合わせの対象外 */}
          {isOwnWorkshop ? (
            <Link
              to={`/inquiries?workshop_id=${workshop.id}`}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              <MaterialIcon name="chat" className="text-[18px]" />
              届いた問い合わせ
            </Link>
          ) : (
            workshop.status !== 'draft' && (
              <button
                type="button"
                onClick={handleInquiryClick}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                <MaterialIcon name="chat" className="text-[18px]" />
                主催者に問い合わせる
              </button>
            )
          )}
        </div>
        <dl className="mt-6 space-y-2 rounded-md bg-slate-50 p-4 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-slate-500">日時</dt>
            <dd className="text-slate-900"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></dd>
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
              {formatPriceYen(workshop.price)}
              {workshop.price > 0 && <span className="ml-1 text-xs font-normal text-slate-500">(当日会場にてお支払いください)</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-slate-500">定員</dt>
            <dd className="flex items-center gap-2 text-slate-900">
              {workshop.capacity}名
              {showSeatStatus && <FewSeatsBadge workshop={workshop} />}
            </dd>
          </div>
        </dl>
        <p className="mt-6 whitespace-pre-wrap text-slate-700">{workshop.description}</p>
      </div>

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
          {/* 予約ボタンと、その下の案内は右寄せにする */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleReserveClick}
              disabled={isStarted || isFull || workshop.viewer.is_reserved || workshop.viewer.is_reservation_canceled}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground enabled:hover:bg-accent-hover disabled:opacity-50"
            >
              {workshop.viewer.is_reserved
                ? '予約済みです'
                : workshop.viewer.is_reservation_canceled
                  ? '予約できません'
                  : isStarted
                  ? '開始済みのため予約できません'
                  : isFull
                    ? '空席がないため予約できません'
                    : !user
                      ? 'ログインして予約する'
                      : `予約する`}
            </button>
          </div>
          {workshop.viewer.is_reserved && (
            <p className="mt-2 text-right text-sm text-slate-500">
              このワークショップは予約済みです。内容は{' '}
              <Link to="/reservations" className="underline">
                参加予定のワークショップ
              </Link>{' '}
              から確認できます。キャンセルをご希望の場合は主催者にご連絡ください。
            </p>
          )}
          {workshop.viewer.is_reservation_canceled && (
            <p className="mt-2 text-right text-sm text-slate-500">
              主催者により参加がキャンセルされたため、このワークショップは予約できません。
            </p>
          )}
        </>
      )}

      {related && (
        <div className="mt-12 border-t border-border-muted pt-4">
          <RelatedWorkshopSection
            title={`${workshop.facilitator_name}さんの他のワークショップ`}
            workshops={related.same_facilitator}
            action={
              <Link
                to={`/facilitators/${workshop.facilitator_id}`}
                className="shrink-0 text-sm text-slate-600 underline hover:text-slate-900"
              >
                主催者のページへ
              </Link>
            }
          />
          <RelatedWorkshopSection title="似ているワークショップ" workshops={related.similar} />
          {/* オンライン開催では、近くの代わりに他のオンライン開催のワークショップが返ってくる */}
          <RelatedWorkshopSection
            title={
              workshop.location_type === 'online'
                ? '他のオンライン開催のワークショップ'
                : '近くで開催されるワークショップ'
            }
            workshops={related.nearby}
          />
        </div>
      )}
    </div>
  )
}
