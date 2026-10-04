import type { LocationType, Workshop } from '@/types'

const HOUR_MS = 60 * 60 * 1000

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
// 予約の連絡先(メールアドレス)の上限。バックエンドの schemas/types.py の EMAIL_MAX_LENGTH と揃える
export const RESERVATION_EMAIL_MAX_LENGTH = 254

// バックエンドの schemas/workshop.py の上限と揃える
export const WORKSHOP_TITLE_MAX_LENGTH = 50
export const WORKSHOP_DESCRIPTION_MAX_LENGTH = 1000
export const WORKSHOP_LOCATION_MAX_LENGTH = 255
export const WORKSHOP_CANCELLATION_POLICY_MAX_LENGTH = 2000
export const WORKSHOP_CAPACITY_MAX = 100
export const WORKSHOP_PRICE_MAX = 100_000
export const WORKSHOP_PARTICIPANT_GUIDE_MAX_LENGTH = 2000
export const WORKSHOP_EMERGENCY_CONTACT_MAX_LENGTH = 255

// 出欠は開始日時のこの時間前から記録できる。バックエンドの routers/workshops.py の ATTENDANCE_OPEN_BEFORE と揃える
export const ATTENDANCE_OPEN_HOURS_BEFORE = 24

// 出欠を記録できる時間になったか
export function isAttendanceOpen(workshop: Pick<Workshop, 'start_at'>): boolean {
  return Date.now() >= new Date(workshop.start_at).getTime() - ATTENDANCE_OPEN_HOURS_BEFORE * HOUR_MS
}

// 開催済み(終了日時を過ぎた)かどうか。開催済みは編集できない(バックエンドの ensure_editable と同じ基準)
export function isWorkshopFinished(workshop: Pick<Workshop, 'end_at'>): boolean {
  return new Date(workshop.end_at).getTime() < Date.now()
}

// 開始日時を過ぎたかどうか。開始済みのワークショップは予約も、予約のキャンセルもできない
export function isWorkshopStarted(workshop: Pick<Workshop, 'start_at'>): boolean {
  return new Date(workshop.start_at).getTime() <= Date.now()
}

// 予約の締め切り。開始日時のこの時間前を過ぎたら予約できない。
// バックエンドの services/workshops.py の RESERVATION_DEADLINE_BEFORE と揃える
export const RESERVATION_DEADLINE_HOURS_BEFORE = 24

// 予約の締め切り日時(開始日時の24時間前)。ISO 8601 形式
export function reservationDeadline(workshop: Pick<Workshop, 'start_at'>): string {
  return new Date(new Date(workshop.start_at).getTime() - RESERVATION_DEADLINE_HOURS_BEFORE * HOUR_MS).toISOString()
}

// 予約の締め切りを過ぎたかどうか。開始済みのものも含む
export function isReservationClosed(workshop: Pick<Workshop, 'start_at'>): boolean {
  return Date.now() >= new Date(reservationDeadline(workshop)).getTime()
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
