import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listMyReservations } from '@/api/reservations'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { useApiResource } from '@/hooks/useApiResource'
import type { Reservation } from '@/types'
import { formatDateTime } from '@/utils/format'
import { refundLabel } from '@/utils/payment'
import { THIRDLY_BUTTON_CLASS } from '@/components/ui/styles'
import { isWorkshopFinished } from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { useBackState } from '@/hooks/useBackState'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

// 予約履歴での状態の表示。ワークショップ自体が中止になったものは、予約の状態より中止を優先して伝える
function reservationStatusView(reservation: Reservation): { label: string; className: string } {
  const refund = refundLabel(reservation.payment)
  // 参加者は自分でキャンセルできないので、キャンセル済みは主催者がキャンセルしたもの
  if (reservation.status === 'canceled') {
    return { label: refund ? `主催者によりキャンセル(${refund})` : '主催者によりキャンセル', className: 'text-fg-subtle' }
  }
  if (reservation.status === 'pending_payment') return { label: 'お支払い待ち', className: 'font-medium text-fg' }
  if (reservation.workshop.status === 'canceled') return { label: '主催者により中止', className: 'font-medium text-red-300' }
  if (isWorkshopFinished(reservation.workshop)) return { label: '参加済み', className: 'text-fg-muted' }
  return { label: '予約確定', className: 'text-emerald-300' }
}

// 参加が確定していて(支払い待ちを含む)、キャンセル・中止になっていない
function isActive(reservation: Reservation): boolean {
  return (
    (reservation.status === 'confirmed' || reservation.status === 'pending_payment') &&
    reservation.workshop.status !== 'canceled'
  )
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

// 表示中のタブは URL のクエリ(?tab=reservations)に持たせる。
// 通知から予約履歴を直接開けるようにし、ワークショップの詳細から戻ったときも同じタブで開き直すため
const TAB_PARAM = 'tab'

function parseHistoryTab(value: string | null): HistoryTab {
  return value === 'reservations' ? 'reservations' : 'attended'
}

// 一覧の種類。参加予定は「参加予定のワークショップ」ページ、残りは「予約・参加履歴」ページのタブ
type ListKind = 'upcoming' | HistoryTab

const EMPTY_MESSAGE: Record<ListKind, string> = {
  upcoming: '参加予定のワークショップはありません。',
  attended: 'まだ参加したワークショップはありません。',
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
        .filter((r) => r.status === 'confirmed' && isActive(r) && isWorkshopFinished(r.workshop))
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
  const backState = useBackState(kind === 'upcoming' ? '参加予定のワークショップ' : '予約・参加履歴')
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
          // ワークショップ管理の一覧と同じく、紙ではなく夜の地より一段明るい面のカードにする。
          // カード全体がリンクなので、中のリンクにフォーカスしたら枠を出す
          <li
            key={reservation.id}
            className="relative flex items-center justify-between gap-4 rounded-lg bg-surface-muted p-4 shadow-card focus-within:ring-2 focus-within:ring-ring"
          >
            <div className="flex min-w-0 items-center gap-6">
              {/* ワークショップ管理の一覧と同じく、タイトルの左にバナー画像を出す。スマホ幅では文字の幅を残すため小さくする */}
              {reservation.workshop.image_url ? (
                <img
                  src={reservation.workshop.image_url}
                  alt=""
                  className="aspect-video h-16 w-auto shrink-0 rounded-md object-cover sm:h-[100px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="aspect-video h-16 shrink-0 rounded-md bg-surface-strong sm:h-[100px]" />
              )}
              <div className="min-w-0">
                {/* WorkshopCard と同じく、タイトルのリンクの当たり判定(::after)をカード全体に広げる */}
                <Link
                  to={`/workshops/${reservation.workshop.id}`}
                  state={backState}
                  className="text-lg font-medium text-fg after:absolute after:inset-0 after:rounded-lg focus:outline-none"
                >
                  {reservation.workshop.title}
                </Link>
                <p className="text-sm text-fg-muted"><WorkshopDateTime start={reservation.workshop.start_at} end={reservation.workshop.end_at} /></p>
                {/* 同じアカウントでは同じ名前で参加する想定なので、参加者名は出さず、どの主催者のワークショップかを出す */}
                <p className="text-sm text-fg-muted">
                  {`主催者: ${reservation.workshop.facilitator_name} ・ チケット${reservation.ticket_count}枚`}
                </p>
                {/* 支払い待ちは、確定していないことが分かるよう参加予定にも出す */}
                {kind === 'upcoming' && reservation.status === 'pending_payment' && (
                  <p className="text-sm font-medium text-fg">
                    お支払い待ち
                    {reservation.payment_expires_at &&
                      `(${formatDateTime(reservation.payment_expires_at)}までにお支払いいただくと予約が確定します)`}
                  </p>
                )}
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
            </div>
            {/* 支払い待ちの予約は、ここから支払いを再開できる。
                カード全体に広げたタイトルのリンクより手前に出すため relative z-10 にする */}
            {kind === 'upcoming' && reservation.status === 'pending_payment' && (
              <Link
                to={`/workshops/${reservation.workshop.id}/reserve`}
                aria-label={`${reservation.workshop.title}のお支払いを再開する`}
                className={`relative z-10 ${THIRDLY_BUTTON_CLASS}`}
              >
                お支払いを再開する
              </Link>
            )}
            {/* 参加予定のワークショップは、当日までに主催者へ聞きたいことが出てきやすいので、ここから問い合わせられるようにする */}
            {kind === 'upcoming' && reservation.status === 'confirmed' && (
              <Link
                to={`/workshops/${reservation.workshop.id}/inquiry`}
                state={backState}
                aria-label={`${reservation.workshop.title}の主催者に問い合わせる`}
                className={`relative z-10 ${THIRDLY_BUTTON_CLASS}`}
              >
                <MaterialIcon name="chat" className="text-[18px]" />
                主催者に問い合わせる
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

// 参加予定のワークショップ(/reservations)
export function MyReservationsPage() {
  return (
    <div>
      <Breadcrumb />
      <h1 className="text-xl font-semibold text-fg">参加予定のワークショップ</h1>
      <p className="mt-1 text-sm text-fg-muted">
        キャンセルをご希望の場合は、ワークショップの主催者にご連絡ください。
      </p>
      <ReservationList kind="upcoming" />
    </div>
  )
}

// 予約・参加履歴(/reservations/history)。参加済みのワークショップと、キャンセル・中止も含めた予約の履歴をタブで切り替える
export function ReservationHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseHistoryTab(searchParams.get(TAB_PARAM))

  // 切り替えは履歴に積まない(戻るボタンで前のページへ戻れるように)。既定のタブはクエリに書かない
  function setTab(next: HistoryTab) {
    setSearchParams(next === 'attended' ? {} : { [TAB_PARAM]: next }, { replace: true })
  }

  return (
    <div>
      <Breadcrumb />
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
