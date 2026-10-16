import { matchPath } from 'react-router-dom'
import { pageTitleForPath } from '@/utils/pageTitle'

export interface Crumb {
  label: string
  // 今いるページ(最後の項目)は持たない
  to?: string
}

// パンくずを出すページと、その1つ上のページ(App.tsx のルートと揃える)。
// 階層が決まっているページだけを載せる。ワークショップの詳細や主催者のページ、規約(マイページからもヘルプ・規約からも開く)のように、
// どこから来たかで戻り先が変わるページは載せず、BackLink(「← ○○に戻る」)を使う
const PARENTS: { path: string; parent: string }[] = [
  { path: '/reservations', parent: '/me' },
  { path: '/reservations/history', parent: '/me' },
  { path: '/favorites', parent: '/me' },
  { path: '/following', parent: '/me' },
  { path: '/notifications', parent: '/me' },
  { path: '/inquiries', parent: '/me' },
  { path: '/inquiries/:id', parent: '/inquiries' },
  { path: '/me/profile', parent: '/me' },
  { path: '/manage', parent: '/me' },
  { path: '/manage/workshops/new', parent: '/manage' },
  { path: '/manage/workshops/:id/edit', parent: '/manage' },
  { path: '/manage/workshops/:id/reservations', parent: '/manage' },
  { path: '/manage/payout', parent: '/me' },
  { path: '/manage/payout-requests', parent: '/me' },
]

function parentOf(pathname: string): string | null {
  return PARENTS.find(({ path }) => matchPath(path, pathname))?.parent ?? null
}

/**
 * パスに対応するパンくず(上の階層から順に、最後が今のページ)。パンくずを出さないページは null。
 * current を渡すと、今のページの名前をそれにする(読み込んだ内容で名前を決めたいとき)
 */
export function breadcrumbsForPath(pathname: string, current?: string): Crumb[] | null {
  if (parentOf(pathname) === null) return null
  const ancestors: Crumb[] = []
  for (let path = parentOf(pathname); path !== null; path = parentOf(path)) {
    ancestors.unshift({ label: pageTitleForPath(path) ?? path, to: path })
  }
  return [...ancestors, { label: current ?? pageTitleForPath(pathname) ?? '' }]
}
