import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getWorkshop } from '@/api/workshops'
import { abandonPayment, listMyReservations, reserveWorkshop } from '@/api/reservations'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatPrice } from '@/utils/format'
import { isOnlinePayment } from '@/utils/payment'
import type { Workshop } from '@/types'
import { parseIdParam } from '@/utils/params'
import {
  getReservationBlocker,
  MAX_TICKETS_PER_RESERVATION,
  RESERVATION_DEADLINE_HOURS_BEFORE,
  RESERVATION_EMAIL_MAX_LENGTH,
} from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { CancellationPolicy } from '@/components/workshop/CancellationPolicy'

interface UnavailableReason {
  message: string
  isError: boolean
  // 省略時はワークショップ詳細へ戻るリンク
  link?: { to: string; label: string }
}

// 予約フォームを出せない理由と、代わりに出すメッセージ。予約できるなら null
function getUnavailableReason(workshop: Workshop): UnavailableReason | null {
  switch (getReservationBlocker(workshop)) {
    case null:
      return null
    case 'not_published':
      return {
        message:
          workshop.status === 'canceled'
            ? 'このワークショップは中止になったため予約できません。'
            : 'このワークショップは公開されていないため予約できません。',
        isError: true,
      }
    case 'reserved':
      return {
        message: 'このワークショップは既に予約済みです。',
        isError: false,
        link: { to: '/reservations', label: '参加予定のワークショップを見る' },
      }
    case 'reservation_canceled':
      return { message: '主催者により参加がキャンセルされたため、このワークショップは予約できません。', isError: true }
    case 'started':
      return { message: 'このワークショップは開始済みのため予約できません。', isError: true }
    case 'closed':
      return {
        message: `予約の受付は開始日時の${RESERVATION_DEADLINE_HOURS_BEFORE}時間前で締め切りました。`,
        isError: true,
      }
    case 'full':
      return { message: 'このワークショップは満員のため予約できません。', isError: true }
  }
}

// 予約後の移動先。オンライン決済なら Stripe の支払い画面、それ以外は参加予定の一覧。
// onRestored はブラウザの「戻る」で Stripe からこの画面がそのまま復元されたときに呼ぶ
function useAfterReservation(onRestored?: () => void) {
  const navigate = useNavigate()
  // Stripe のページが開くまでの間に、もう一度押されないよう、移動を始めたら押せないままにする
  const [redirecting, setRedirecting] = useState(false)
  const onRestoredRef = useRef(onRestored)
  useEffect(() => {
    onRestoredRef.current = onRestored
  })

  // 復元されたときは押せる状態に戻し、予約の状態を取り直す。
  // 取り直さないと、支払い待ちなのに入力フォームが出たままになり、選び直した枚数が使われない
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return
      setRedirecting(false)
      onRestoredRef.current?.()
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  function goNext(checkoutUrl: string | null, workshopTitle: string) {
    if (checkoutUrl) {
      setRedirecting(true)
      window.location.assign(checkoutUrl)
      return
    }
    navigate('/reservations', { state: { justReserved: workshopTitle } })
  }

  return { redirecting, goNext }
}

// オンライン決済の支払い待ちのまま戻ってきた人に、支払いの再開か取りやめを選んでもらう
function PendingPaymentPanel({ workshop, onChanged }: { workshop: Workshop; onChanged: (abandoned: boolean) => void }) {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const action = useAsyncAction<'resume' | 'abandon'>()
  const { redirecting, goNext } = useAfterReservation(() => onChanged(false))
  // Stripe の支払い画面で「戻る」を押すと、payment=canceled を付けてここへ戻される
  const returnedFromCheckout = searchParams.get('payment') === 'canceled'

  async function handleResume() {
    // 支払い待ちのまま予約し直すと、同じ支払いの画面が返る(送った入力内容は使われず、最初の予約のまま)
    const result = await action.run(
      () => reserveWorkshop(workshop.id, { contact: user?.email ?? '', ticket_count: 1 }),
      'お支払いを再開できませんでした',
      'resume',
    )
    if (result.ok) goNext(result.value.checkout_url, workshop.title)
  }

  async function handleAbandon() {
    if (!confirm('お支払いをやめて、お取りしていた席をお戻ししますか?')) return
    const result = await action.run(
      async () => {
        const mine = await listMyReservations()
        const pending = mine.find((r) => r.workshop_id === workshop.id && r.status === 'pending_payment')
        // 見つからなければ、その間に期限が過ぎたか支払いが済んだ。取り直して今の状態を出す
        if (!pending) return false
        await abandonPayment(pending.id)
        return true
      },
      '予約を取りやめられませんでした',
      'abandon',
    )
    if (result.ok) onChanged(result.value)
  }

  const busy = action.pending || redirecting
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">お支払いが完了していません</h1>
      <PaperCard cornerFold={false} className="mt-4 space-y-4 p-6">
        <p className="text-sm">
          {returnedFromCheckout ? 'お支払いの画面から戻りました。' : ''}
          「{workshop.title}」の席は、しばらくの間お取りしています。お支払いを済ませると予約が確定します。
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleAbandon}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-muted disabled:opacity-50"
          >
            {action.pendingKey === 'abandon' ? '取りやめています...' : '予約をやめる'}
          </button>
          <button type="button" onClick={handleResume} disabled={busy} className={PRIMARY_BUTTON_CLASS}>
            {action.pendingKey === 'resume' || redirecting ? '移動しています...' : 'お支払いを再開する'}
          </button>
        </div>
        <ErrorMessage message={action.error} className="text-sm" />
      </PaperCard>
    </div>
  )
}

export function ReservationFormPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const workshopId = parseIdParam(id)
  const {
    data: workshop,
    loading,
    error: loadError,
    reload,
  } = useApiResource(
    workshopId === null ? null : `workshop:${workshopId}`,
    (signal) => getWorkshop(workshopId!, signal),
    'ワークショップの取得に失敗しました',
  )
  // 予約の送信に失敗したときのメッセージ
  const submitAction = useAsyncAction()
  const { redirecting, goNext } = useAfterReservation(reload)
  // 支払いをやめたことを、入力フォームに戻ったあとも伝える
  const [abandoned, setAbandoned] = useState(false)

  // ログインが必要なページ(ProtectedRoute の内側)なので、表示時点で user は読み込み済み。
  // 初期値として一度だけ入れ、あとから user が更新されても入力中の内容は上書きしない
  const [contact, setContact] = useState(user?.email ?? '')
  const [ticketCount, setTicketCount] = useState(1)
  // 内容を確認したことのチェック。チェックするまで予約を確定できない
  const [confirmed, setConfirmed] = useState(false)

  const contactId = useId()
  const contactHelpId = useId()
  const ticketCountId = useId()
  const ticketCountHelpId = useId()
  const confirmedId = useId()

  function handleCancelClick() {
    if (!workshop) return
    navigate(`/workshops/${workshop.id}`)
  }

  // 取り直している間は前の表示を残す(支払いをやめた直後などにページ全体が入れ替わらないように)
  if (loading && !workshop) return <LoadingMessage />
  if (!workshop)
    return (
      <ErrorMessage message={loadError ?? 'ワークショップが見つかりませんでした'} />
    )

  const remaining = workshop.capacity - workshop.reserved_count
  const maxTickets = Math.max(1, Math.min(remaining, MAX_TICKETS_PER_RESERVATION))
  const totalPrice = workshop.price * ticketCount
  const online = isOnlinePayment(workshop)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!workshop) return
    const result = await submitAction.run(
      () => reserveWorkshop(workshop.id, { contact, ticket_count: ticketCount }),
      online ? '予約またはお支払いの準備ができませんでした' : '予約に失敗しました',
    )
    if (result.ok) {
      goNext(result.value.checkout_url, workshop.title)
    } else if (online) {
      // 席の確保だけ済んで支払い画面に進めなかった場合もあるので、取り直して今の状態を出す
      reload()
    }
  }

  // オンライン決済の途中で戻ってきた人には、入力欄の代わりに支払いの再開・取りやめを出す
  if (workshop.viewer.is_payment_pending && getReservationBlocker(workshop) === null) {
    return (
      <PendingPaymentPanel
        workshop={workshop}
        onChanged={(didAbandon) => {
          setAbandoned(didAbandon)
          reload()
        }}
      />
    )
  }

  const submitBusy = submitAction.pending || redirecting
  const submitLabel = online
    ? submitBusy
      ? '移動しています...'
      : 'お支払いへ進む'
    : submitBusy
      ? '登録中...'
      : '予約を確定する'


  // 予約できない場合は、理由と戻り先のリンクだけを出す
  const unavailable = getUnavailableReason(workshop)
  if (unavailable) {
    const detailLink = { to: `/workshops/${workshop.id}`, label: 'ワークショップ詳細に戻る' }
    const link = unavailable.link ?? detailLink
    return (
      <div className="mx-auto max-w-xl">
        <p className={unavailable.isError ? 'text-red-300' : 'text-fg-secondary'}>{unavailable.message}</p>
        <Link to={link.to} className="mt-4 inline-block text-sm text-fg-secondary underline">
          {link.label}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">参加者情報の入力</h1>
      {abandoned && (
        <p role="status" className="mt-2 text-sm text-fg-secondary">
          お支払いを取りやめ、お取りしていた席をお戻ししました。
        </p>
      )}
      {/* 予約するワークショップと入力欄を、一覧・詳細のカードと同じ紙の面にまとめる。
          右下の角の折れが予約ボタンにかからないよう、下の余白を広めに取る */}
      <PaperCard className="mt-4 p-4 pb-10 sm:p-6 sm:pb-10">
        <div className="border-b border-border pb-4 text-sm">
          <p className="font-semibold text-fg">{workshop.title}</p>
          <p className="mt-1 text-fg-muted"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} dateStyle="long" /></p>
          <p className="text-fg-muted">
            {workshop.location_type === 'online' ? 'オンライン' : workshop.location}
          </p>
          <p className="mt-1 text-fg-muted">残席: {remaining} / {workshop.capacity}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* 同じアカウントでは同じ名前で参加する想定なので、名前は入力させずアカウント名で予約する */}
          <dl>
            <dt className="text-sm font-medium text-fg-secondary">お名前</dt>
            <dd className="mt-1 text-sm text-fg">{user?.name}</dd>
          </dl>
          <div>
            <label htmlFor={contactId} className="block text-sm font-medium text-fg-secondary">
              メールアドレス
            </label>
            <input
              id={contactId}
              type="email"
              autoComplete="email"
              required
              maxLength={RESERVATION_EMAIL_MAX_LENGTH}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="例: example@mail.com"
              aria-describedby={contactHelpId}
              className={INPUT_CLASS}
            />
            <p id={contactHelpId} className="mt-1 text-xs text-fg-muted">
              主催者からの連絡に使います。
            </p>
          </div>
          <div>
            <label htmlFor={ticketCountId} className="block text-sm font-medium text-fg-secondary">
              チケット枚数
            </label>
            <select
              id={ticketCountId}
              value={ticketCount}
              onChange={(e) => setTicketCount(Number(e.target.value))}
              aria-describedby={ticketCountHelpId}
              className={INPUT_CLASS}
            >
              {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}枚
                </option>
              ))}
            </select>
            <p id={ticketCountHelpId} className="mt-1 text-xs text-fg-muted">
              1回の予約で最大{maxTickets}枚まで選択できます。
            </p>
          </div>

          <div className="rounded-lg bg-surface/70 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-secondary">
                {online
                  ? 'お支払い金額(次の画面でカードでお支払いいただきます)'
                  : 'お支払い金額(当日会場にてお支払いください)'}
              </span>
              <span className="font-semibold text-fg">{formatPrice(totalPrice)}</span>
            </div>
            <CancellationPolicy
              price={workshop.price}
              policy={workshop.cancellation_policy}
              headingAs="p"
              className="mt-3 border-t border-border-muted pt-3"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id={confirmedId}
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent focus-ring focus:outline-none"
            />
            <label htmlFor={confirmedId} className="text-sm text-fg">
              {workshop.price > 0 && workshop.cancellation_policy
                ? 'ワークショップの内容とキャンセルポリシーを確認しました'
                : 'ワークショップの内容を確認しました'}
            </label>
          </div>

          <ErrorMessage message={submitAction.error} className="text-sm" />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancelClick}
              className="rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-muted"
            >
              キャンセル
            </button>
            <button type="submit" disabled={submitBusy || !confirmed} className={PRIMARY_BUTTON_CLASS}>
              {submitLabel}
            </button>

          </div>
        </form>
      </PaperCard>
    </div>
  )
}
