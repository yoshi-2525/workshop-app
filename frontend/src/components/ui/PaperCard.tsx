import type { ReactNode } from 'react'

// 夜の地に置かれた紙のカード。ワークショップのカードや詳細・フォームなど、紙の面はすべてこれを使い、見た目をここでまとめて管理する。
// 色や質感は index.css の theme-paper / paper-corner-fold / shadow-paper で定義している。
// 余白はカードごとに違うので className で渡す
// (角の折れは右下 28px に重なるので、右下に入力欄やボタンが来るカードは下の余白を広めに取る)
interface PaperCardProps {
  children: ReactNode
  className?: string
  // 右下の角の折れ。余白が狭く、折れが文字にかかる小さいカードでは false にする
  cornerFold?: boolean
  // カード全体がリンクになっている(一覧のカードなど)とき。ホバーで少し持ち上げ、中のリンクにフォーカスしたら枠を出す
  interactive?: boolean
}

const BASE_CLASS = 'relative rounded-lg theme-paper shadow-paper'
const INTERACTIVE_CLASS =
  'transition focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-paper-lift motion-reduce:hover:translate-y-0'

export function PaperCard({ children, className = '', cornerFold = true, interactive = false }: PaperCardProps) {
  const classes = [BASE_CLASS, cornerFold && 'paper-corner-fold', interactive && INTERACTIVE_CLASS, className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes}>{children}</div>
}
