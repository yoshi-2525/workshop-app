import { useEffect } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PaperCard } from '@/components/ui/PaperCard'

// 参加登録の完了を伝えたあと、トップページへ移るまでの時間。アニメーション(約 1.5 秒)を見終えてから移る
const REDIRECT_DELAY_MS = 4500

// 予約の完了画面(/reservations/complete)へ移るときに渡す state
export interface ReservationCompleteState {
  workshopTitle: string
}

export const RESERVATION_COMPLETE_PATH = '/reservations/complete'

const LINK_CLASS = 'text-sm text-fg-secondary underline hover:text-fg focus-ring focus:outline-hidden rounded-sm'

// 参加登録が済んだことを、円と印が静かに描かれるアニメーションで伝え、しばらくしてトップページへ移る。
// 現地払いの予約の確定後と、オンライン決済の支払いの確定後の両方からここへ来る
export function ReservationCompletePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const workshopTitle = (location.state as ReservationCompleteState | null)?.workshopTitle

  useEffect(() => {
    if (!workshopTitle) return
    const timer = window.setTimeout(() => navigate('/', { replace: true }), REDIRECT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [workshopTitle, navigate])

  // URL を直接開いたときなど、完了したばかりの予約がなければトップページへ
  if (!workshopTitle) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-md">
      <PaperCard cornerFold={false} className="flex flex-col items-center px-6 py-10 text-center">
        {/* 円をゆっくり描き、続けて印を描く。色はチェックボックスと同じ差し色。動きを減らす設定の環境では、描き終えた状態で出す */}
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          className="h-20 w-20 text-accent"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            strokeWidth="2"
            pathLength={1}
            strokeDasharray="1"
            className="origin-center -rotate-90 animate-draw-stroke motion-reduce:animate-none"
          />
          <path
            d="M21 33 l7.5 7.5 L44 25"
            strokeWidth="3"
            pathLength={1}
            strokeDasharray="1"
            className="animate-draw-stroke [animation-delay:670ms] [animation-duration:400ms] motion-reduce:animate-none"
          />
        </svg>

        <div className="mt-6 animate-quiet-fade-in [animation-delay:930ms] motion-reduce:animate-none">
          <h1 className="font-brand text-xl font-semibold text-fg">参加登録が完了しました</h1>
          <p role="status" className="mt-3 text-sm text-fg-secondary">
            ワークショップにお申込みいただきありがとうございます。
          </p>
          <p className="mt-6 text-xs text-fg-muted">まもなくトップページに移ります。</p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link to="/" replace className={LINK_CLASS}>
              トップページへ
            </Link>
            <Link to="/reservations" replace className={LINK_CLASS}>
              参加予定のワークショップを見る
            </Link>
          </div>
        </div>
      </PaperCard>
    </div>
  )
}
