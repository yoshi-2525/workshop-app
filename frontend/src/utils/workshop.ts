import type { LocationType, Workshop } from '../types'

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  online: 'オンライン',
  offline: '会場',
}

// バックエンドの ReservationCreate.ticket_count の上限と揃える
export const MAX_TICKETS_PER_RESERVATION = 20

export function isWorkshopFull(workshop: Workshop): boolean {
  return workshop.reserved_count >= workshop.capacity
}

// 無料は白背景でコントラスト比 4.5:1 以上になる emerald-700 を使う
export function priceTextClass(price: number): string {
  return price > 0 ? 'font-semibold text-slate-900' : 'font-semibold text-emerald-700'
}
