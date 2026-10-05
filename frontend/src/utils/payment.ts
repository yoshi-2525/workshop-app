import type { CancelReason, PaymentSummary, Workshop } from '@/types'
import { formatYen } from '@/utils/format'

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

// 参加者向けの、オンライン決済の返金の状況。返金の対象でなければ null。
// 主催者向けは paymentStatusLabel(返金額と、返金できていないことまで出す)
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

// 取消の理由ごとの返金額と、差し引く手数料。主催者都合は全額、参加者都合は決済手数料と本サービスの手数料を差し引く。
// 画面で事前に見せるための計算で、実際の額はバックエンドの services/payments.py の refund_amount_for が決める
export function refundAmountFor(
  payment: Pick<PaymentSummary, 'amount' | 'stripe_fee_amount' | 'application_fee_amount'>,
  reason: CancelReason,
): { refund: number; stripeFee: number; serviceFee: number } {
  if (reason === 'facilitator') return { refund: payment.amount, stripeFee: 0, serviceFee: 0 }
  const stripeFee = payment.stripe_fee_amount ?? 0
  const serviceFee = payment.application_fee_amount ?? 0
  return { refund: Math.max(0, payment.amount - stripeFee - serviceFee), stripeFee, serviceFee }
}

// 主催者向けの、予約ごとのオンライン決済の状態。返金は額まで出す(いくら返したかを確かめられるように)。
// 表示しないもの(支払い待ち・期限切れ)は null
export function paymentStatusLabel(payment: Pick<PaymentSummary, 'status' | 'refund_amount'> | null): string | null {
  const refund = payment?.refund_amount ?? 0
  switch (payment?.status) {
    case 'paid':
      return 'オンライン決済済み'
    case 'refund_pending':
      return `返金手続き中(${formatYen(refund)})`
    case 'refunded':
      // 参加者都合で手数料を差し引くと返金額が残らない場合は、返金していない
      return refund > 0 ? `返金済み(${formatYen(refund)})` : '返金なし(手数料の差し引きにより0円)'
    case 'refund_failed':
      return `返金できていません(${formatYen(refund)}。運営が対応します)`
    default:
      return null
  }
}
