// ページや操作の状態を伝える短いメッセージ。
// 入力欄ごとの検証メッセージ(aria-describedby で結び付けるもの)には使わない

interface MessageProps {
  // 余白など、置き場所に合わせて足すクラス
  className?: string
}

export function LoadingMessage({ className = '' }: MessageProps) {
  return (
    <p role="status" className={`text-fg-muted ${className}`.trim()}>
      読み込み中...
    </p>
  )
}

// 読み込みや操作に失敗したことを伝える。message が空(null など)なら何も出さない
export function ErrorMessage({ message, className = '' }: MessageProps & { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className={`text-red-300 ${className}`.trim()}>
      {message}
    </p>
  )
}
