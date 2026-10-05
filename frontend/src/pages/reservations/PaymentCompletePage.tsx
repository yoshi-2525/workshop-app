import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyReservation } from '@/api/reservations'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { PAPER_SECONDARY_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { useApiResource } from '@/hooks/useApiResource'
import type { Reservation } from '@/types'
import { refundLabel } from '@/utils/payment'
import { parseIdParam } from '@/utils/params'

// 支払いの確定を確かめる回数と間隔。Stripe からの通知(Webhook)は通常数秒で届く
const MAX_CHECKS = 10
const CHECK_INTERVAL_MS = 2000

const LINK_CLASS = 'text-sm text-fg-secondary underline hover:text-fg'

type View = 'checking' | 'slow' | 'confirmed' | 'canceled_workshop' | 'refunding' | 'expired'

function viewOf(reservation: Reservation | undefined, gaveUp: boolean): View {
  if (!reservation || reservation.status === 'pending_payment') return gaveUp ? 'slow' : 'checking'
  if (reservation.status === 'confirmed') {
    return reservation.workshop.status === 'canceled' ? 'canceled_workshop' : 'confirmed'
  }
  return refundLabel(reservation.payment) !== null ? 'refunding' : 'expired'
}

function messageOf(view: View, title: string): string {
  switch (view) {
    case 'checking':
      return 'お支払いを確認しています。このままお待ちください。'
    case 'slow':
      return 'お支払いの確認に時間がかかっています。確認が済むと、参加予定のワークショップに表示されます。'
    case 'confirmed':
      return `お支払いが完了し、「${title}」への参加が確定しました。当日の案内は、参加予定のワークショップから確認できます。`
    case 'canceled_workshop':
      return `お支払いは完了しましたが、「${title}」は中止になりました。お支払いいただいた参加費は全額返金します。`
    case 'refunding':
      return 'お支払いは受け付けましたが、お支払いの間に満席になったなどの理由で、参加を確定できませんでした。お支払いいただいた参加費は全額返金します。'
    case 'expired':
      return 'お支払いの期限が過ぎたため、予約は確定していません。'
  }
}

// Stripe の支払い画面で支払いを終えたあとに戻ってくる画面。予約が確定したことを確かめて伝える
export function PaymentCompletePage() {
  const { id } = useParams<{ id: string }>()
  const reservationId = parseIdParam(id)
  const { data, error, reload } = useApiResource(
    reservationId === null ? null : `my-reservation:${reservationId}`,
    (signal) => getMyReservation(reservationId!, signal),
    '予約の確認に失敗しました',
  )
  // 確認の途中で通信に一度失敗しても、最後に取得できた予約で表示を続ける(失敗したように見せない)
  const [lastData, setLastData] = useState<Reservation>()
  // 取得できたら描画中に覚え直す(effect で後から合わせると1回余分に描画されるため)
  if (data && data !== lastData) setLastData(data)
  const reservation = data ?? lastData

  const [checks, setChecks] = useState(1)
  const gaveUp = checks >= MAX_CHECKS
  const view = viewOf(reservation, gaveUp)
  // まだ確定していない(または取得に失敗した)間は、上限まで少し間をおいて確かめ直す
  const shouldRecheck = (view === 'checking' && (reservation !== undefined || error !== null)) && !gaveUp

  useEffect(() => {
    if (!shouldRecheck) return
    const timer = window.setTimeout(() => {
      setChecks((n) => n + 1)
      reload()
    }, CHECK_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [data, error, shouldRecheck, reload])

  function checkAgain() {
    setChecks(1)
    reload()
  }

  if (reservationId === null) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold text-fg">お支払いの確認</h1>
        <ErrorMessage message="予約が見つかりませんでした" className="mt-4" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">お支払いの確認</h1>
      <PaperCard cornerFold={false} className="mt-4 space-y-4 p-6">
        {/* 結果が変わったことを読み上げるよう、ライブリージョンは置いたまま中身だけを入れ替える */}
        <p role="status" className="text-sm">
          {messageOf(view, reservation?.workshop.title ?? '')}
        </p>
        {/* 一度も取得できないまま確認をあきらめたときだけ、通信の失敗を伝える */}
        {gaveUp && !reservation && <ErrorMessage message={error} className="text-sm" />}

        {view === 'confirmed' && (
          <div className="flex justify-end">
            <Link to="/reservations" className={PRIMARY_BUTTON_CLASS}>
              参加予定のワークショップを見る
            </Link>
          </div>
        )}
        {view === 'slow' && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link to="/reservations" className={LINK_CLASS}>
              参加予定のワークショップを見る
            </Link>
            <button type="button" onClick={checkAgain} className={PAPER_SECONDARY_BUTTON_CLASS}>
              もう一度確認する
            </button>
          </div>
        )}
        {(view === 'expired' || view === 'refunding' || view === 'canceled_workshop') && reservation && (
          <Link to={`/workshops/${reservation.workshop_id}`} className={LINK_CLASS}>
            ワークショップ詳細に戻る
          </Link>
        )}
      </PaperCard>
    </div>
  )
}
