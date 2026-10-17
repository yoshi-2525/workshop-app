import { useId } from 'react'
import { Link } from 'react-router-dom'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'

// 夜空に散らす星 [x, y, 半径, 不透明度]。座標は 320×180 の枠の中。またたかせず静止させる
const STARS: [number, number, number, number][] = [
  [36, 34, 1.2, 0.6],
  [92, 16, 0.9, 0.45],
  [138, 48, 1.1, 0.55],
  [196, 22, 0.8, 0.4],
  [300, 104, 1, 0.45],
  [24, 112, 0.8, 0.35],
  [168, 92, 0.9, 0.35],
  [282, 150, 1.1, 0.4],
]

// 月明かりの下で、途中で途切れてしまった点線の小道。「道に迷った」ことを静かに表す。
// 装飾なので読み上げない。動きを減らす設定の環境では、はじめから描き終えた状態で出す
function LostPathIllustration() {
  // グラデーションの id。useId の「:」は url(#...) で使えないので取り除く
  const id = useId().replace(/:/g, '')
  const glowId = `glow${id}`
  const fadeId = `fade${id}`
  return (
    <svg aria-hidden="true" viewBox="0 0 320 180" className="mx-auto block h-auto w-full max-w-[640px]">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
          <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        {/* 小道は手前ほどはっきり、先へ行くほど夜に溶けて見えなくなる */}
        <linearGradient id={fadeId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-fg)" stopOpacity="0.7" />
          <stop offset="75%" stopColor="var(--color-fg)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-fg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="244" cy="56" r="50" fill={`url(#${glowId})`} />
      {/* 月は差し色より少し明るい黄色にする(予約完了の絵と同じ色) */}
      <path d="M238 38 a18 18 0 1 0 18 25 a14 14 0 1 1 -18 -25z" fill="#f0cf8f" opacity="0.9" />
      <g fill="var(--color-fg)">
        {STARS.map(([cx, cy, r, opacity]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={opacity} />
        ))}
      </g>
      <path
        d="M40 172 C 70 150, 120 160, 130 136 S 108 104, 150 96 S 196 108, 214 84"
        fill="none"
        stroke={`url(#${fadeId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 7"
        className="animate-quiet-fade-in [animation-delay:200ms] motion-reduce:animate-none"
      />
      {/* 小道の手前に置いた、手元の灯り */}
      <circle cx="40" cy="172" r="3" fill="var(--color-accent)" opacity="0.9" />
    </svg>
  )
}

// 存在しない URL を開いたとき(App.tsx で /404 に移す)。
// 迷った人を責めず、次に行ける場所を静かに示す。
// 文章は左上、月と小道の絵を大きく真ん中に、次に行ける場所のボタンは右下に置く
export function NotFoundPage() {
  const fadeIn = 'animate-quiet-fade-in motion-reduce:animate-none'
  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <div className={`${fadeIn} [animation-delay:400ms]`}>
        <p className="text-sm tracking-[0.3em] text-fg-muted">404</p>
        <h1 className="mt-2 font-brand text-2xl font-semibold tracking-widest text-fg sm:text-3xl">
          ページが見つかりません
        </h1>
        <p className="mt-4 leading-loose text-fg-secondary">
          少しばかり道に迷ってしまったようです。
          <br />
          お探しのページは移動したか、なくなった可能性があります。
        </p>
      </div>
      <div className="mt-6 sm:-mt-6">
        <LostPathIllustration />
      </div>
      <div className={`${fadeIn} [animation-delay:600ms] mt-6 flex flex-wrap justify-end gap-3`}>
        <Link to="/help" className={SECONDARY_BUTTON_CLASS}>
          ヘルプを見る
        </Link>
        <Link to="/" className={PRIMARY_BUTTON_CLASS}>
          対話をさがす
        </Link>
      </div>
    </div>
  )
}
