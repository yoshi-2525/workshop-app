import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRelatedWorkshops, getWorkshop } from '@/api/workshops'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { Avatar } from '@/components/ui/Avatar'
import { FavoriteButton } from '@/components/workshop/FavoriteButton'
import { LocationTypeBadge } from '@/components/workshop/LocationTypeBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { NoImage } from '@/components/ui/NoImage'
import { RelatedWorkshopSection } from '@/components/workshop/RelatedWorkshopSection'
import { ShareButton } from '@/components/workshop/ShareButton'
import { FewSeatsBadge, FullBadge } from '@/components/workshop/SeatStatusBadge'
import { formatPriceYen } from '@/utils/format'
import { googleMapsSearchUrl } from '@/utils/maps'
import { parseIdParam } from '@/utils/params'
import {
  getReservationBlocker,
  isReservationClosed,
  isWorkshopStarted,
  RESERVATION_DEADLINE_HOURS_BEFORE,
  reservationDeadline,
  type ReservationBlocker,
} from '@/utils/workshop'
import { getLastListUrl } from '@/utils/workshopListState'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { BackLink } from '@/components/ui/BackLink'
import { CancellationPolicy } from '@/components/workshop/CancellationPolicy'

// 予約できないときの予約ボタンの文言(予約ボタンは公開中のときだけ出すので、not_published は出ない)
const RESERVE_BUTTON_BLOCKED_LABEL: Record<ReservationBlocker, string> = {
  not_published: '予約できません',
  reserved: '予約済みです',
  reservation_canceled: '予約できません',
  started: '開始済みのため予約できません',
  closed: '予約の受付は終了しました',
  full: '空席がないため予約できません',
}

// 最後に見ていた一覧(検索条件・ページ番号つき)へ戻り、スクロール位置も復元させる
function BackToListLink() {
  return (
    <BackLink to={getLastListUrl()} state={{ restoreScroll: true }}>ワークショップ一覧に戻る</BackLink>
  )
}

export function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const workshopId = parseIdParam(id)
  // 別のワークショップへ遷移したときは key が変わるので、前のデータやエラーは残らない
  const resourceKey = workshopId === null ? null : `workshop:${workshopId}`
  const { data: workshop, loading, error } = useApiResource(
    resourceKey,
    (signal) => getWorkshop(workshopId!, signal),
    'ワークショップの取得に失敗しました',
  )
  // 関連するワークショップは本体とは別に読み込む。補助的な情報なので、取得に失敗しても欄を出さないだけにする
  const { data: related } = useApiResource(
    resourceKey,
    (signal) => getRelatedWorkshops(workshopId!, signal),
    '関連するワークショップの取得に失敗しました',
  )
  // 読み込めなかった画像の URL。一致する間は画像なしと同じ表示にする(別のワークショップへ移れば URL が変わる)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)

  // ログインが必要なページへ移る。未ログインならログイン画面を挟み、ログイン後にそのページへ戻す
  function navigateWithLogin(path: string) {
    if (!user) {
      navigate('/login/participant', { state: { from: path } })
      return
    }
    navigate(path)
  }

  if (loading) return <LoadingMessage />
  if (!workshop)
    return (
      <div>
        <BackToListLink />
        <ErrorMessage message={error ?? 'ワークショップが見つかりませんでした'} />
      </div>
    )
  const imageFailed = workshop.image_url === failedImageUrl

  const reservationBlocker = getReservationBlocker(workshop)
  const isStarted = isWorkshopStarted(workshop)
  const isClosed = isReservationClosed(workshop)
  // 満員・残席僅かは予約を受け付けている(公開中で開始前の)ときだけ意味があるので、それ以外は出さない
  const showSeatStatus = workshop.status === 'published' && !isStarted
  const isOwnWorkshop = user?.id === workshop.facilitator_id

  return (
    <div className="mx-auto max-w-3xl">
      <BackToListLink />
      {/* 画像から説明文までを1枚のカードにまとめる。一覧のカードと同じ紙の面にする */}
      <PaperCard className="p-4 pb-10 sm:p-6 sm:pb-10">
        {workshop.image_url && !imageFailed ? (
          <img
            src={workshop.image_url}
            alt=""
            className="mx-auto mb-4 aspect-video w-full max-w-xl rounded-md object-cover"
            onError={() => setFailedImageUrl(workshop.image_url)}
          />
        ) : (
          <NoImage className="mx-auto mb-4 max-w-xl rounded-md" />
        )}
        {workshop.status === 'canceled' && (
          <p role="status" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm font-medium text-red-200">
            このワークショップは中止になりました。
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {/* 満員はタイトルの横に出す(残席僅かは定員の右) */}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-2xl font-semibold text-fg">{workshop.title}</h1>
            {showSeatStatus && <FullBadge workshop={workshop} />}
          </div>
          {/* 共有とお気に入りは、紙の上で目立つよう白い丸で囲む(日時などの欄と同じ白) */}
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <ShareButton path={`/workshops/${workshop.id}`} title={workshop.title} className="rounded-full bg-surface shadow-sm" />
            {workshop.status === 'published' && (
              <FavoriteButton
                workshopId={workshop.id}
                isFavorited={workshop.viewer.is_favorited}
                size="lg"
                className="rounded-full bg-surface shadow-sm"
              />
            )}
          </div>
        </div>
        {/* アイコンと名前をまとめて主催者ページへのリンクにする */}
        <div className="py-4 flex items-center gap-2 text-sm text-fg-muted">
          <p className="flex items-center gap-2 text-base">
            主催者:
            <Link
              to={`/facilitators/${workshop.facilitator_id}`}
              className="flex items-center gap-2 text-fg-secondary underline"
            >
              <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} className="h-8 w-8 text-sm" />
              {workshop.facilitator_name}
            </Link>
          </p>
          {/* 自分のワークショップなら届いた問い合わせへ、そうでなければ主催者への問い合わせへ。下書きは問い合わせの対象外 */}
          {isOwnWorkshop ? (
            <Link
              to={`/inquiries?workshop_id=${workshop.id}`}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-surface px-3 py-1.5 text-fg-secondary shadow-sm hover:bg-white"
            >
              <MaterialIcon name="chat" className="text-[18px]" />
              届いた問い合わせ
            </Link>
          ) : (
            workshop.status !== 'draft' && (
              <button
                type="button"
                onClick={() => navigateWithLogin(`/workshops/${workshop.id}/inquiry`)}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-surface px-3 py-1.5 text-fg-secondary shadow-sm hover:bg-white"
              >
                <MaterialIcon name="chat" className="text-[18px]" />
                主催者に問い合わせる
              </button>
            )
          )}
        </div>
        <dl className="mt-6 space-y-2 rounded-md bg-surface/70 p-4 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-fg-muted">日時</dt>
            <dd className="text-fg"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></dd>
          </div>
          {/* 予約を受け付けている(公開中で開始前の)ときだけ意味があるので、満員・残席僅かと同じ条件で出す */}
          {showSeatStatus && (
            <div className="flex gap-2">
              <dt className="w-20 font-medium text-fg-muted">予約締切</dt>
              <dd className="text-fg">
                <WorkshopDateTime start={reservationDeadline(workshop)} />
                <span className="ml-1 text-xs text-fg-muted">
                  ({isClosed ? '受付は終了しました' : `開始日時の${RESERVATION_DEADLINE_HOURS_BEFORE}時間前まで`})
                </span>
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-fg-muted">場所</dt>
            <dd className="text-fg">
              <LocationTypeBadge type={workshop.location_type} className="mr-1.5" />
              {workshop.location}
              {workshop.location_type === 'offline' && (
                <a
                  href={googleMapsSearchUrl(workshop.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-fg-muted underline hover:text-fg-secondary"
                >
                  地図で見る
                </a>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-fg-muted">参加費</dt>
            <dd className="text-fg">
              {formatPriceYen(workshop.price)}
              {workshop.price > 0 && <span className="ml-1 text-xs text-fg-muted">(当日会場にてお支払いください)</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 font-medium text-fg-muted">定員</dt>
            <dd className="flex items-center gap-2 text-fg">
              {workshop.capacity}名
              {showSeatStatus && <FewSeatsBadge workshop={workshop} />}
            </dd>
          </div>
        </dl>
        {/* キャンセルポリシーは日時などの欄のすぐ下に置く。見た目は予約フォームのキャンセルポリシーとそろえる */}
        <CancellationPolicy
          price={workshop.price}
          policy={workshop.cancellation_policy}
          className="mt-4 rounded-lg bg-surface/70 p-4"
        />
        <p className="mt-6 whitespace-pre-wrap text-fg-secondary">{workshop.description}</p>
        {workshop.status === 'published' && (
          <>
            {/* 予約ボタンと、その下の案内はカードの右下(予約フォームと同じ位置)に右寄せで置く */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => navigateWithLogin(`/workshops/${workshop.id}/reserve`)}
                disabled={reservationBlocker !== null}
                className={PRIMARY_BUTTON_CLASS}
              >
                {reservationBlocker !== null
                  ? RESERVE_BUTTON_BLOCKED_LABEL[reservationBlocker]
                  : user
                    ? '予約する'
                    : 'ログインして予約する'}
              </button>
            </div>
            {workshop.viewer.is_reserved && (
              <p className="mt-2 text-right text-sm text-fg-muted">
                このワークショップは予約済みです。内容は{' '}
                <Link to="/reservations" className="underline">
                  参加予定のワークショップ
                </Link>{' '}
                から確認できます。キャンセルをご希望の場合は主催者にご連絡ください。
              </p>
            )}
            {workshop.viewer.is_reservation_canceled && (
              <p className="mt-2 text-right text-sm text-fg-muted">
                主催者により参加がキャンセルされたため、このワークショップは予約できません。
              </p>
            )}
          </>
        )}
      </PaperCard>

      {/* 予約した参加者と主催者にだけ返される。どちらも未入力なら出さない */}
      {workshop.status === 'published' &&
        workshop.participant_info &&
        (workshop.participant_info.guide || workshop.participant_info.emergency_contact) && (
          <section
            aria-labelledby="participant-info-heading"
            className="mt-6 rounded-lg border border-sky-400/30 bg-sky-400/10 p-4"
          >
            <h2 id="participant-info-heading" className="text-sm font-semibold text-sky-200">
              参加者へのご案内
              {!workshop.viewer.is_reserved && (
                <span className="ml-2 text-xs font-normal text-fg-muted">(予約した参加者にだけ表示されます)</span>
              )}
            </h2>
            {workshop.participant_info.guide && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{workshop.participant_info.guide}</p>
            )}
            {workshop.participant_info.emergency_contact && (
              <p className="mt-3 text-sm text-fg">
                <span className="font-medium text-sky-200">緊急連絡先：</span>
                <span className="whitespace-pre-wrap">{workshop.participant_info.emergency_contact}</span>
              </p>
            )}
          </section>
        )}

      {related && (
        <div className="mt-12 border-t border-border-muted pt-4">
          <RelatedWorkshopSection
            title={`${workshop.facilitator_name}さんの他のワークショップ`}
            workshops={related.same_facilitator}
            action={
              <Link
                to={`/facilitators/${workshop.facilitator_id}`}
                className="shrink-0 text-sm text-fg-secondary underline hover:text-fg"
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
