import type { LocationType } from '@/types'
import { LOCATION_TYPE_LABEL } from '@/utils/workshop'

// 色を使いすぎないよう、オンライン・会場とも同じ無彩色のバッジにする(文字で見分ける)
export function LocationTypeBadge({ type, className = '' }: { type: LocationType; className?: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium bg-fg/10 text-fg-secondary ${className}`}>
      {LOCATION_TYPE_LABEL[type]}
    </span>
  )
}
