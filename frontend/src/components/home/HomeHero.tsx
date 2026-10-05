import { Link } from 'react-router-dom'

// ヒーロー全体に散らす遠くの星 [x, y, 半径, 不透明度]。座標は 1000×400 の枠の中。
// 見出しと本文が載る左側は少なめ・薄めにして、文字の読みやすさを保つ
const SKY_STARS: [number, number, number, number][] = [
  [520, 40, 1.4, 0.8],
  [610, 120, 1, 0.56],
  [680, 30, 1.2, 0.72],
  [560, 210, 0.9, 0.48],
  [640, 300, 1.3, 0.64],
  [720, 190, 1, 0.48],
  [760, 360, 1.2, 0.56],
  [840, 260, 0.9, 0.48],
  [900, 330, 1.4, 0.72],
  [960, 220, 1, 0.56],
  [980, 60, 1.2, 0.64],
  [470, 330, 1, 0.35],
  [430, 120, 0.9, 0.28],
  [380, 20, 1.2, 0.42],
  [300, 60, 0.8, 0.28],
  [180, 20, 1, 0.35],
  [60, 50, 0.9, 0.28],
  [20, 380, 1, 0.28],
  [350, 390, 0.9, 0.28],
  [580, 380, 1.1, 0.48],
]

// トップページの冒頭。サービスの空気感(夜・静けさ・寄り添い)を伝える。
// 月と星は装飾なので読み上げない
export function HomeHero() {
  return (
    <section aria-labelledby="home-hero-heading" className="relative overflow-hidden py-12 sm:py-20">
      {/* 背景の星空。枠に合わせて切り抜いて広げる(星が楕円につぶれないよう縦横比は保つ) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full text-fg"
      >
        <g fill="currentColor">
          {SKY_STARS.map(([cx, cy, r, opacity]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={opacity} />
          ))}
        </g>
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 200 120"
        className="pointer-events-none absolute -right-6 top-4 w-56 text-accent sm:right-4 sm:w-72"
      >
        {/* 細い三日月。円から少しずらした円をくり抜いて作る。まわりに灯りのような淡い光をにじませる */}
        <defs>
          <filter id="home-hero-moon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <mask id="home-hero-moon">
            <rect width="200" height="120" fill="white" />
            <circle cx="160" cy="38" r="22" fill="black" />
          </mask>
        </defs>
        <circle
          cx="150"
          cy="46"
          r="24"
          fill="currentColor"
          opacity="0.45"
          mask="url(#home-hero-moon)"
          filter="url(#home-hero-moon-glow)"
        />
        <circle cx="150" cy="46" r="24" fill="currentColor" mask="url(#home-hero-moon)" />
        {/* 遠くの星 */}
        <g fill="currentColor" className="text-fg">
          <circle cx="40" cy="30" r="1" opacity="0.9" />
          <circle cx="92" cy="12" r="0.8" opacity="0.6" />
          <circle cx="110" cy="70" r="1.2" opacity="0.75" />
          <circle cx="60" cy="95" r="0.8" opacity="0.52" />
          <circle cx="190" cy="100" r="1" opacity="0.68" />
          <circle cx="125" cy="22" r="0.9" opacity="0.75" />
          <circle cx="185" cy="15" r="1.1" opacity="0.83" />
          <circle cx="178" cy="78" r="0.7" opacity="0.6" />
          <circle cx="135" cy="95" r="1" opacity="0.68" />
          <circle cx="72" cy="55" r="0.7" opacity="0.52" />
          <circle cx="15" cy="70" r="0.9" opacity="0.45" />
        </g>
      </svg>

      <p className="text-sm tracking-[0.25em] text-fg-muted">夜、ひとりで考えていたこと。</p>
      <h1
        id="home-hero-heading"
        className="mt-5 font-brand text-3xl font-semibold leading-snug tracking-widest text-fg sm:text-5xl sm:leading-tight"
      >
        その違和感は、
        <br />
        話していい。
      </h1>
      <p className="mt-8 max-w-2xl leading-loose text-fg-secondary">
        うまく言葉にならなくても、答えが出なくても、かまいません。
        <br className="hidden sm:inline" />
        仕事帰りに、同じように立ち止まっている誰かと、少しだけ話してみませんか。
      </p>
      <Link
        to="/about"
        className="mt-6 inline-block text-sm text-fg-muted underline underline-offset-4 hover:text-fg-secondary"
      >
        TAIWA について
      </Link>
      <div aria-hidden="true" className="mt-12 h-px w-16 bg-accent/60" />
    </section>
  )
}
