export function formatPrice(price: number): string {
  if (price <= 0) return '無料'
  return `¥${price.toLocaleString('ja-JP')}`
}

export function formatDateTime(value: string, dateStyle: 'full' | 'medium' = 'medium'): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ja-JP', { dateStyle, timeStyle: 'short' })
}
