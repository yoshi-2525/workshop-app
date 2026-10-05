import type { ReactNode } from 'react'
import { Link, useLocation, type LinkProps } from 'react-router-dom'
import { readBackTarget } from '@/hooks/useBackState'

const CLASS_NAME = 'mb-4 inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg hover:underline'

// ページ上部の「← ○○に戻る」リンク。
// リンク元が useBackState で戻り先を渡していればそこへ戻る(マイページから規約を開いたらマイページへ戻る、など)。
// 渡されていない(直接開いた・再読み込みした)ときは、to / state / children で指定した既定の戻り先を使う
export function BackLink({ children, ...linkProps }: Omit<LinkProps, 'className'> & { children: ReactNode }) {
  const location = useLocation()
  const backTo = readBackTarget(location.state)

  return (
    <Link {...(backTo ? { to: backTo.to } : linkProps)} className={CLASS_NAME}>
      <span aria-hidden="true">←</span>
      {backTo ? `${backTo.label}に戻る` : children}
    </Link>
  )
}
