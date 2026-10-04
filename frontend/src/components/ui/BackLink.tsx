import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

// ページ上部の「← ○○に戻る」リンク
export function BackLink({ children, ...linkProps }: Omit<LinkProps, 'className'> & { children: ReactNode }) {
  return (
    <Link
      {...linkProps}
      className="mb-4 inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg hover:underline"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  )
}
