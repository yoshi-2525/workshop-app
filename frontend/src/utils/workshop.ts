import type { LocationType, Workshop } from '@/types'

// カードなどのバッジに出す短い表記
export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  online: 'オンライン',
  offline: '会場',
}

// 開催形式を選ぶボタン(一覧の絞り込み・作成フォーム)の選択肢。ToggleGroup の options にそのまま渡せる
export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'offline', label: 'オフライン(会場)' },
  { value: 'online', label: 'オンライン' },
]

// バックエンドの schemas/reservation.py の上限と揃える
export const MAX_TICKETS_PER_RESERVATION = 4
export const RESERVATION_FIELD_MAX_LENGTH = 255
// 予約の連絡先(メールアドレス)の上限。バックエンドの schemas/types.py の EMAIL_MAX_LENGTH と揃える
export const RESERVATION_EMAIL_MAX_LENGTH = 254

// バックエンドの schemas/workshop.py の上限と揃える
export const WORKSHOP_TITLE_MAX_LENGTH = 50
export const WORKSHOP_DESCRIPTION_MAX_LENGTH = 1000
export const WORKSHOP_LOCATION_MAX_LENGTH = 255
export const WORKSHOP_CANCELLATION_POLICY_MAX_LENGTH = 2000
export const WORKSHOP_CAPACITY_MAX = 100
export const WORKSHOP_PRICE_MAX = 100_000

// ワークショップ画像として受け付ける形式と大きさ
export const WORKSHOP_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const WORKSHOP_IMAGE_MAX_BYTES = 5 * 1024 * 1024

// 開催済み(終了日時を過ぎた)かどうか。開催済みは編集できない(バックエンドの ensure_editable と同じ基準)
export function isWorkshopFinished(workshop: Pick<Workshop, 'end_at'>): boolean {
  return new Date(workshop.end_at).getTime() < Date.now()
}

// 開始日時を過ぎたかどうか。開始済みのワークショップは予約も、予約のキャンセルもできない
export function isWorkshopStarted(workshop: Pick<Workshop, 'start_at'>): boolean {
  return new Date(workshop.start_at).getTime() <= Date.now()
}

export function isWorkshopFull(workshop: Workshop): boolean {
  return workshop.reserved_count >= workshop.capacity
}

// 残りの席数がこの数以下になったら「残席僅か」と表示する
export const FEW_SEATS_THRESHOLD = 5

// 満員ではないが、残りの席が少ないかどうか
export function hasFewSeats(workshop: Workshop): boolean {
  const remaining = workshop.capacity - workshop.reserved_count
  return remaining > 0 && remaining <= FEW_SEATS_THRESHOLD
}

// 無料は白背景でコントラスト比 4.5:1 以上になる emerald-700 を使う
export function priceTextClass(price: number): string {
  return price > 0 ? 'font-semibold text-slate-900' : 'font-semibold text-emerald-700'
}
