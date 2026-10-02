import type { Workshop } from '@/types'
import { hasFewSeats, isWorkshopFull } from '@/utils/workshop'

// 長いタイトルや定員の横でも、つぶれたり折り返したりしないようにする
const BASE = 'shrink-0 whitespace-nowrap rounded-full font-medium'

// タイトルの横に出す「満員」のバッジ。満員でなければ何も出さない
export function FullBadge({ workshop }: { workshop: Workshop }) {
  if (!isWorkshopFull(workshop)) return null
  return <span className={`${BASE} bg-red-100 px-2.5 py-0.5 text-sm text-red-700`}>満員</span>
}

// 定員の右に出す「残席僅か」のバッジ。満員のときや残席に余裕があるときは何も出さない
export function FewSeatsBadge({ workshop }: { workshop: Workshop }) {
  if (!hasFewSeats(workshop)) return null
  return <span className={`${BASE} bg-amber-100 px-2 py-0.5 text-xs text-amber-800`}>残席僅か</span>
}
