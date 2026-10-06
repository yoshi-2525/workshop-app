import type { CancelReason, PaymentSummary, Workshop } from '@/types'
import { formatYen } from '@/utils/format'

// オンライン決済(Stripe)まわりの値と判定

// 主催者の売上・振込の画面と、運営が振込の申請を処理する画面
export const PAYOUT_SETTINGS_PATH = '/manage/payout'
export const ADMIN_PAYOUT_REQUESTS_PATH = '/manage/payout-requests'
// 本サービスの手数料率(参加費に対する %、1円未満切り捨て)。残りが主催者の受取額になる。
// 主催者ガイドラインなどの表示に使う。バックエンドの settings.platform_fee_percent(.env の PLATFORM_FEE_PERCENT)と揃える
export const PLATFORM_FEE_PERCENT = 10
// 主催者の受取額の割合(%)
export const FACILITATOR_SHARE_PERCENT = 100 - PLATFORM_FEE_PERCENT

// 振込を申請できる最低額と、振込1回ごとの振込手数料(主催者の負担)。規約・ガイドラインの表示に使う。
// 実際の額は API(売上の状況)が返す。バックエンドの settings.payout_min_amount・payout_transfer_fee と揃える
export const PAYOUT_MIN_AMOUNT = 1000
export const PAYOUT_TRANSFER_FEE = 250

// オンライン決済で受け付ける参加費の下限(Stripe の日本円の最低決済額)。
// バックエンドの schemas/workshop.py の ONLINE_PAYMENT_MIN_PRICE と揃える
export const ONLINE_PAYMENT_MIN_PRICE = 50

// オンライン決済の支払い待ちで席を確保しておく時間(分)の、文書での目安。
// バックエンドの services/payments.py の PAYMENT_HOLD(32分。Stripe を呼ぶまでの余裕を含む)と揃える
export const PAYMENT_HOLD_MINUTES_APPROX = 30

// 主催者都合・中止などで全額を返金するときの、主催者の売上の扱いの説明。
// 返金になった支払いは主催者の売上に数えない(バックエンドの services/payouts.py の _earning_criteria)
export const FULL_REFUND_FEE_NOTE = 'その参加費は主催者の売上になりませんが、手数料の負担もありません。'

// 移動してよい Stripe の画面のホスト。バックエンドが返す URL(Checkout の支払い画面)のホストだけに絞る
const STRIPE_REDIRECT_HOSTS = new Set(['checkout.stripe.com'])

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
  payment: Pick<PaymentSummary, 'amount' | 'stripe_fee_amount' | 'platform_fee_amount'>,
  reason: CancelReason,
): { refund: number; stripeFee: number; serviceFee: number } {
  if (reason === 'facilitator') return { refund: payment.amount, stripeFee: 0, serviceFee: 0 }
  const stripeFee = payment.stripe_fee_amount ?? 0
  const serviceFee = payment.platform_fee_amount ?? 0
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

// オンライン決済の返金の扱いの説明。参加者向けの要約と特定商取引法に基づく表記で使う。
// バックエンドの services/payments.py の refund_amount_for と揃える
export const ONLINE_REFUND_SUMMARY =
  '主催者の都合によるキャンセルとワークショップの中止は全額を、参加者のご都合によるキャンセルは決済手数料と本サービスの手数料を差し引いた額を返金します。'

// 有料のワークショップの、キャンセルと返金についての案内(本サービスのキャンセルポリシーの要約)。無料なら null。
// 返金の扱いはバックエンドの services/payments.py の refund_amount_for と揃える
export function cancellationSummary(workshop: Pick<Workshop, 'price' | 'payment_method'>): string | null {
  if (workshop.price <= 0) return null
  if (isOnlinePayment(workshop)) {
    return `${ONLINE_REFUND_SUMMARY}キャンセルをご希望の場合は、主催者にご連絡ください。`
  }
  return '参加者のご都合によるキャンセルに、キャンセル料はかかりません。キャンセルをご希望の場合は、主催者にご連絡ください。'
}
