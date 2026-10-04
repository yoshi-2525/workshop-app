// アイコンだけのボタンの上に、ホバー・キーボードでのフォーカス中だけ小さなラベルを表示する。
// ボタンに className="peer" を付け、このラベルをボタンの直後(同じ relative な親の中)に置いて使う。
// ボタン自体の名前は aria-label で伝えているので、ラベルは読み上げない
export function HoverLabel({ text, hidden = false }: { text: string; hidden?: boolean }) {
  if (hidden) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface-strong px-2 py-1 text-xs text-fg opacity-0 transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
    >
      {text}
    </span>
  )
}
