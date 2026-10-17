import { useId, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PaperCard } from '@/components/ui/PaperCard'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import type { Reservation } from '@/types'
import { formatPriceYen } from '@/utils/format'
import { isOnlinePayment } from '@/utils/payment'

// 予約の完了画面(/reservations/complete)へ移るときに渡す state。確定したばかりの予約(ワークショップの情報を含む)
export interface ReservationCompleteState {
  reservation: Reservation
}

export const RESERVATION_COMPLETE_PATH = '/reservations/complete'

// 四方に光る星。(x, y) を中心に半径 r で描く
function sparklePath(x: number, y: number, r: number): string {
  return `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`
}

const SPARKLES = [
  { x: 84, y: 56, r: 7, accent: true, opacity: 0.9 },
  { x: 232, y: 140, r: 6, accent: true, opacity: 0.7 },
  { x: 52, y: 104, r: 4, accent: false, opacity: 0.6 },
  { x: 214, y: 34, r: 4, accent: false, opacity: 0.55 },
  { x: 104, y: 150, r: 3.5, accent: false, opacity: 0.45 },
  { x: 286, y: 92, r: 3, accent: true, opacity: 0.6 },
]
const DOTS = [
  { x: 128, y: 24, r: 1.4, opacity: 0.6 },
  { x: 196, y: 160, r: 1.4, opacity: 0.5 },
  { x: 36, y: 66, r: 1.2, opacity: 0.4 },
  { x: 246, y: 78, r: 1.2, opacity: 0.45 },
  { x: 140, y: 168, r: 1, opacity: 0.4 },
]

// 円と印が静かに描かれたあと、まわりに月と星が浮かぶ夜空の絵。
// 動きを減らす設定の環境では、描き終えた状態で出す
function CompletionIllustration() {
  // グラデーションの id。useId の「:」は url(#...) で使えないので取り除く
  const glowId = `glow${useId().replace(/:/g, '')}`
  const fadeIn = 'animate-quiet-fade-in [animation-delay:1100ms] motion-reduce:animate-none'
  return (
    <svg aria-hidden="true" viewBox="0 0 320 180" className="mx-auto block h-auto w-full max-w-[320px]">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
          <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="90" r="86" fill={`url(#${glowId})`} />
      <g className={fadeIn}>
        {/* 月は差し色より少し明るい黄色にして、星の金色と見分けられるようにする */}
        <path d="M262 30 a14 14 0 1 0 14 20 a11 11 0 1 1 -14 -20z" fill="#f0cf8f" opacity="0.92" />
        {SPARKLES.map((s) => (
          <path
            key={`${s.x}-${s.y}`}
            d={sparklePath(s.x, s.y, s.r)}
            fill={s.accent ? 'var(--color-accent)' : 'var(--color-fg)'}
            opacity={s.opacity}
          />
        ))}
        {DOTS.map((d) => (
          <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} fill="var(--color-fg)" opacity={d.opacity} />
        ))}
      </g>
      <g
        transform="translate(124 54)"
        fill="none"
        stroke="var(--color-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="36"
          cy="36"
          r="32"
          strokeWidth="2"
          pathLength={1}
          strokeDasharray="1"
          className="origin-center -rotate-90 animate-draw-stroke [transform-box:fill-box] motion-reduce:animate-none"
        />
        <path
          d="M24 37 l8.5 8.5 L50 28"
          strokeWidth="3"
          pathLength={1}
          strokeDasharray="1"
          className="animate-draw-stroke [animation-delay:670ms] [animation-duration:400ms] motion-reduce:animate-none"
        />
      </g>
    </svg>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  )
}

function StepItem({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border text-xs text-fg-muted"
      >
        {number}
      </span>
      <span>{children}</span>
    </li>
  )
}

// 参加登録が済んだことを夜空の絵で伝え、参加するワークショップの内容と、このあとの流れを示す。
// 現地払いの予約の確定後と、オンライン決済の支払いの確定後の両方からここへ来る
export function ReservationCompletePage() {
  const location = useLocation()
  const reservation = (location.state as ReservationCompleteState | null)?.reservation

  // URL を直接開いたときなど、完了したばかりの予約がなければトップページへ
  if (!reservation) return <Navigate to="/" replace />

  const { workshop } = reservation
  const total = workshop.price * reservation.ticket_count
  const paymentNote =
    total <= 0 ? null : isOnlinePayment(workshop) ? '(お支払い済み)' : '(当日会場でお支払いください)'
  const fadeIn = 'animate-quiet-fade-in motion-reduce:animate-none'

  return (
    <div className="mx-auto max-w-xl pt-4 text-center">
      <CompletionIllustration />
      <div className={`${fadeIn} [animation-delay:930ms]`}>
        <h1 className="mt-3 font-brand text-2xl font-semibold tracking-wider text-fg">参加登録が完了しました</h1>
        <p role="status" className="mt-2.5 text-[15px] text-fg-secondary">
          お申込みいただきありがとうございます。当日お会いできるのを楽しみにしています。
        </p>
      </div>

      <div className={`${fadeIn} [animation-delay:1300ms] text-left`}>
        <PaperCard as="section" aria-label="参加するワークショップ" cornerFold={false} className="mt-9 overflow-hidden">
          <div className="px-6 pb-4 pt-5">
            <p className="text-xs tracking-wider text-fg-muted">参加するワークショップ</p>
            <p className="mt-1.5 text-lg font-semibold leading-snug text-fg">{workshop.title}</p>
          </div>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2.5 border-t border-dashed border-border px-6 pb-5 pt-4 text-sm text-fg">
            <DetailRow label="日時">
              <WorkshopDateTime start={workshop.start_at} end={workshop.end_at} />
            </DetailRow>
            <DetailRow label="場所">
              {workshop.location_type === 'online' ? `オンライン ・ ${workshop.location}` : workshop.location}
            </DetailRow>
            <DetailRow label="人数">
              {reservation.ticket_count}名 ・ 参加費 {formatPriceYen(total)}
              {paymentNote}
            </DetailRow>
          </dl>
        </PaperCard>

        <section
          aria-labelledby="next-steps-heading"
          className="mt-7 rounded-lg bg-surface-muted px-5 py-5 shadow-card sm:px-6"
        >
          <h2 id="next-steps-heading" className="text-sm font-semibold text-fg">
            このあとの流れ
          </h2>
          <ol className="mt-3 space-y-3 text-sm leading-relaxed text-fg-secondary">
            <StepItem number={1}>当日の案内などは、主催者からのメッセージで届きます。「問い合わせ」から確認できます。</StepItem>
            <StepItem number={2}>開催が近づくと、通知でお知らせします。</StepItem>
          </ol>
        </section>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Link to="/" className={SECONDARY_BUTTON_CLASS}>
            ほかのワークショップをさがす
          </Link>
          {/* 問い合わせページは、主催者とのやり取りがあればそのトーク画面へ移る */}
          <Link to={`/workshops/${workshop.id}/inquiry`} className={PRIMARY_BUTTON_CLASS}>
            主催者からのメッセージを見る
          </Link>
        </div>
      </div>
    </div>
  )
}
