// Google の Material Symbols(Outlined)のアイコンを表示する。
// フォントは index.html で読み込んでおり、使えるのはそこの icon_names に指定したアイコンだけ。
// 飾りとして扱うので、意味は親要素の aria-label などで伝える
export function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined select-none leading-none ${className}`}>
      {name}
    </span>
  )
}
