import type { PaymentSummary, Workshop } from '@/types'

// オンライン決済(Stripe)まわりの値と判定

// 主催者の受け取り設定の画面。Stripe の設定画面から戻ってくる先なので、
// バックエンドの services/payments.py の PAYOUT_SETTINGS_PATH と揃える
export const PAYOUT_SETTINGS_PATH = '/manage/payout'
// オンライン決済で受け付ける参加費の下限(Stripe の日本円の最低決済額)。
// バックエンドの schemas/workshop.py の ONLINE_PAYMENT_MIN_PRICE と揃える
export const ONLINE_PAYMENT_MIN_PRICE = 50

// Stripe の設定画面の URL の期限が切れたときに付いて戻ってくるクエリ(バックエンドの refresh_url と揃える)
export const PAYOUT_LINK_EXPIRED_PARAM = 'refresh'

// 移動してよい Stripe の画面のホスト。バックエンドが返す URL のホストだけに絞る
// (Checkout は checkout.stripe.com、受け取り設定と Express ダッシュボードは connect.stripe.com)
const STRIPE_REDIRECT_HOSTS = new Set(['checkout.stripe.com', 'connect.stripe.com'])

// API から受け取った Stripe の画面の URL が、https の Stripe のページか確かめる。
// 外部へ移動する前の確認として、不具合などで別のサイトや javascript: の URL が来ても開かないようにする
export function isStripeRedirectUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && STRIPE_REDIRECT_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

// 予約時に Stripe で参加費を支払うワークショップか(無料なら支払いはない)
export function isOnlinePayment(workshop: Pick<Workshop, 'price' | 'payment_method'>): boolean {
  return workshop.price > 0 && workshop.payment_method === 'online'
}

// 参加費の欄に添える、支払い方の案内。無料なら null
export function paymentNote(workshop: Pick<Workshop, 'price' | 'payment_method'>): string | null {
  if (workshop.price <= 0) return null
  return isOnlinePayment(workshop) ? '予約時にカードでお支払いいただきます' : '当日会場にてお支払いください'
}

// オンライン決済の返金の状況。返金の対象でなければ null
export function refundLabel(payment: Pick<PaymentSummary, 'status'> | null): string | null {
  switch (payment?.status) {
    case 'refund_pending':
    case 'refund_failed':
      return '返金手続き中'
    case 'refunded':
      return '返金済み'
    default:
      return null
  }
}
