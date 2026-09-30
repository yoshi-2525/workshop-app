// 画像が登録されていない(または読み込めない)ときに、画像と同じ 16:9 の枠で代わりに表示する。
// 角丸は画像に合わせて呼び出し側で className に指定する
export function NoImage({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-video w-full flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m21 16-5-5-9 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-medium tracking-wider">NO IMAGE</span>
    </div>
  )
}
