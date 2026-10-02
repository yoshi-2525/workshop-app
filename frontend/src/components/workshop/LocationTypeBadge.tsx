import type { LocationType } from '@/types'
import { LOCATION_TYPE_LABEL } from '@/utils/workshop'

const BADGE_STYLE: Record<LocationType, string> = {
  online: 'bg-sky-100 text-sky-700',
  offline: 'bg-orange-100 text-orange-700',
}

export function LocationTypeBadge({ type, className = '' }: { type: LocationType; className?: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_STYLE[type]} ${className}`}>
      {LOCATION_TYPE_LABEL[type]}
    </span>
  )
}
