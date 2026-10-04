export function formatPrice(price: number): string {
  if (price <= 0) return '無料'
  return `¥${price.toLocaleString('ja-JP')}`
}

// 「3,000円」の形式。0円以下は formatPrice と同じく「無料」と出す
export function formatPriceYen(price: number): string {
  if (price <= 0) return '無料'
  return `${price.toLocaleString('ja-JP')}円`
}

export function formatDateTime(value: string, dateStyle: 'full' | 'medium' = 'medium'): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ja-JP', { dateStyle, timeStyle: 'short' })
}

// 「14:00」の形式。端末の時間帯で表示する
export function formatTime(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('ja-JP', { timeStyle: 'short' })
}
