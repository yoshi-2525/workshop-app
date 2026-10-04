import { useState } from 'react'

// 主催者アイコンを丸く切り抜いて表示する。
// アイコンが未設定(または読み込めない)ときは、名前の1文字目を丸の中に表示する。
// 名前は横に文字で出す前提なので、画像は読み上げない(alt="")
export function Avatar({ url, name, className = 'h-10 w-10 text-base' }: { url: string; name: string; className?: string }) {
  // 読み込みに失敗した URL を覚えておき、URL が変わったらもう一度表示を試す
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt=""
        className={`shrink-0 rounded-full border border-border-muted object-cover ${className}`}
        onError={() => setFailedUrl(url)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-fg/10 font-semibold text-fg-secondary ${className}`}
    >
      {Array.from(name.trim())[0] ?? ''}
    </span>
  )
}
