export function formatPrice(price: number): string {
  if (price <= 0) return '無料'
  return `¥${price.toLocaleString('ja-JP')}`
}
