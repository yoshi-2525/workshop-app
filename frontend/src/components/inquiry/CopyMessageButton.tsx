import { useEffect, useState } from 'react'
import { HoverLabel } from '@/components/ui/HoverLabel'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

// コピーできたこと(または失敗したこと)を表示しておく時間
const RESULT_DISPLAY_MS = 2000

// メッセージの本文をクリップボードにコピーするボタン。
// ふだんは隠しておき、メッセージ(親の group)にマウスを乗せたとき・フォーカスしたときに出す。
// マウスを乗せられないタッチ端末では常に出し、押しやすいよう少し大きくする
interface CopyMessageButtonProps {
  text: string
  // ボタンの名前に入れる、どのメッセージかの説明(「あなたの 10:30 のメッセージ」など)。
  // メッセージの数だけ同じボタンが並ぶので、読み上げで区別できるようにする
  label: string
  // 失敗の表示を寄せる側。画面の端からはみ出さないよう、吹き出しのある側へ寄せる
  align: 'start' | 'end'
  className?: string
}

export function CopyMessageButton({ text, label, align, className = '' }: CopyMessageButtonProps) {
  const [result, setResult] = useState<'copied' | 'failed' | null>(null)

  useEffect(() => {
    if (!result) return
    const timer = setTimeout(() => setResult(null), RESULT_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [result])

  async function handleCopy() {
    try {
      // navigator.clipboard は https か localhost でしか使えない
      await navigator.clipboard.writeText(text)
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`${label}をコピー`}
        className={`peer inline-flex items-center justify-center rounded-full p-1 text-fg-muted pointer-coarse:p-2 transition hover:text-fg-secondary focus-visible:opacity-100 pointer-coarse:opacity-100 group-hover:opacity-100 ${
          result ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <MaterialIcon name={result === 'copied' ? 'check' : 'content_copy'} className="text-[16px]" />
      </button>
      {/* 失敗の表示と重ならないよう、そのときはラベルを出さない */}
      <HoverLabel text={result === 'copied' ? 'コピーしました' : 'コピー'} hidden={result === 'failed'} />
      {/* 結果は読み上げでも伝える。失敗したときは目に見える形でも出す */}
      <span role="status" className="sr-only">
        {result === 'copied' ? 'メッセージをコピーしました' : ''}
      </span>
      {result === 'failed' && (
        <span
          role="alert"
          className={`absolute bottom-full z-20 mb-1 w-max rounded-md border border-red-400/30 bg-surface px-2 py-1 text-xs text-red-300 shadow ${
            align === 'start' ? 'left-0' : 'right-0'
          }`}
        >
          コピーできませんでした
        </span>
      )}
    </span>
  )
}
