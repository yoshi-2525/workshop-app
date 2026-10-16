import { Link, useLocation } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { breadcrumbsForPath } from '@/utils/breadcrumbs'

// ページ上部のパンくず(「マイページ > ワークショップ管理 > 予約状況」)。
// 階層は utils/breadcrumbs.ts の対応表で決まり、載っていないページでは何も出さない
// (戻り先が来た経路で変わるページは、代わりに BackLink を使う)。
// current を渡すと、最後の項目(今のページ)の名前をそれにする
export function Breadcrumb({ current }: { current?: string }) {
  const { pathname } = useLocation()
  const crumbs = breadcrumbsForPath(pathname, current)
  if (!crumbs) return null

  return (
    <nav aria-label="パンくずリスト" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
        {crumbs.map((crumb, index) => (
          // 区切りの矢印は項目の数に入らないよう、各項目の中に読み上げない形で置く
          <li key={crumb.to ?? 'current'} className="flex min-w-0 items-center gap-x-1">
            {index > 0 && <MaterialIcon name="chevron_right" className="text-[16px] text-fg-subtle" />}
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="rounded-sm text-fg-secondary hover:text-fg hover:underline focus-ring focus:outline-hidden"
              >
                {crumb.label}
              </Link>
            ) : (
              // 今のページは見出しと同じ内容なので、目立たせずに置く
              <span aria-current="page" className="truncate text-fg-muted">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
