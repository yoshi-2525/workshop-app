// 対話のルール(/rules)のイラスト。TAIWA について と同じく、紺・金・生成りと黄色い月の平たい図形で描く。
// どれも飾りなので aria-hidden にしている(意味は見出しと本文で伝える)

// 冒頭: 灯りに照らされた一枚の紙(ルールの紙)とペン、湯気の立つカップ
export function RulesHeroIllustration() {
  return (
    <svg className="block h-auto w-full rounded-xl bg-[#0e1628] shadow-card" viewBox="0 0 800 260" aria-hidden="true">
    <defs><radialGradient id="rules-hero-rg"><stop offset="0" stopColor="#e3b071" stopOpacity="0.3"/><stop offset="1" stopColor="#e3b071" stopOpacity="0"/></radialGradient></defs>
    <circle cx="80" cy="50" r="1.5" fill="#ece7dc" opacity="0.6"/><circle cx="220" cy="30" r="1.1" fill="#ece7dc" opacity="0.5"/><circle cx="560" cy="40" r="1.2" fill="#ece7dc" opacity="0.5"/><circle cx="720" cy="110" r="1.1" fill="#ece7dc" opacity="0.4"/><path d="M150 84 Q150 90 156 90 Q150 90 150 96 Q150 90 144 90 Q150 90 150 84Z" fill="#e3b071" opacity="0.85"/><path d="M620 65 Q620 70 625 70 Q620 70 620 75 Q620 70 615 70 Q620 70 620 65Z" fill="#ece7dc" opacity="0.7"/>
    <path d="M690 34 a20 20 0 1 0 20 28 a16 16 0 1 1 -20 -28z" fill="#f0cf8f" opacity="0.92"/>
    <circle cx="400" cy="190" r="190" fill="url(#rules-hero-rg)"/>
    <rect x="0" y="210" width="800" height="50" fill="#121a2c"/><line x1="0" y1="210" x2="800" y2="210" stroke="#313d58" strokeWidth="1.5"/>
    <ellipse cx="400" cy="212" rx="250" ry="12" fill="#232e49"/>
    <line x1="262" y1="210" x2="262" y2="140" stroke="#3a4766" strokeWidth="5"/>
    <path d="M234 144 L290 144 L278 110 L246 110 Z" fill="#e3b071"/><ellipse cx="262" cy="145" rx="28" ry="4" fill="#f0cf8f"/>
    <path d="M350 206 L470 206 L496 184 L376 184 Z" fill="#d3d8e1"/>
    <g stroke="#8f99ad" strokeWidth="2" strokeLinecap="round"><path d="M392 190 h70 M386 196 h62 M380 202 h50"/></g>
    <rect x="500" y="196" width="70" height="5" rx="2.5" fill="#e3b071" transform="rotate(-12 535 198)"/>
    <ellipse cx="640" cy="209" rx="24.6" ry="2.4" fill="#bcc3d1"/><path d="M653.5 189.75 Q664.6 190.22 663.1 197.47 Q661.6 203.32 652.75 202.85" fill="none" stroke="#d3d8e1" strokeWidth="2.25" strokeLinecap="round"/><path d="M625.0 184.6 L655.0 184.6 L652.6 205.19 Q652.0 208 649.0 208 L631.0 208 Q628.0 208 627.4 205.19 Z" fill="#d3d8e1"/><ellipse cx="640" cy="184.6" rx="15.0" ry="2.1" fill="#3b2b1d"/><path d="M640 182 C630 175.7 652 171.2 640 164" fill="none" stroke="#e3b071" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}

// 聴くとき: 耳
export function ListenIcon() {
  return (
    <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12 a7 7 0 1 1 12 5 c-2 2 -3 3 -3 6 a3 3 0 0 1 -6 0"/><path d="M15 13 a2.5 2.5 0 1 1 4 2"/></g></svg>
  )
}

// 話すとき: 吹き出し
export function TalkIcon() {
  return (
    <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8 h20 a2 2 0 0 1 2 2 v10 a2 2 0 0 1 -2 2 h-11 l-5 4 v-4 h-4 a2 2 0 0 1 -2 -2 v-10 a2 2 0 0 1 2 -2 z"/></g></svg>
  )
}

// 場を守るために: 家
export function PlaceIcon() {
  return (
    <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15 L16 6 L27 15"/><path d="M8 13 v13 h16 v-13"/><path d="M13 26 v-6 h6 v6"/></g></svg>
  )
}
