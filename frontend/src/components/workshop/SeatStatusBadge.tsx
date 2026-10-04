import type { Workshop } from '@/types'
import { hasFewSeats, isReservationClosed, isWorkshopFull } from '@/utils/workshop'

// 長いタイトルや定員の横でも、つぶれたり折り返したりしないようにする
const BASE = 'shrink-0 whitespace-nowrap rounded-full font-medium'

// タイトルの横に出す「受付終了」「満員」のバッジ。予約を受け付けていれば何も出さない
export function FullBadge({ workshop }: { workshop: Workshop }) {
  if (isReservationClosed(workshop))
    return <span className={`${BASE} bg-surface-strong px-2.5 py-0.5 text-sm text-fg-muted`}>受付終了</span>
  if (!isWorkshopFull(workshop)) return null
  return <span className={`${BASE} bg-red-400/15 px-2.5 py-0.5 text-sm text-red-200`}>満員</span>
}

// 定員の右に出す「残席僅か」のバッジ。満員・受付終了のときや残席に余裕があるときは何も出さない
export function FewSeatsBadge({ workshop }: { workshop: Workshop }) {
  if (isReservationClosed(workshop) || !hasFewSeats(workshop)) return null
  return <span className={`${BASE} bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200`}>残席僅か</span>
}
