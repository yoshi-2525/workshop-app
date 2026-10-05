// オンライン決済(Stripe)まわりの値と判定

// 主催者の受け取り設定の画面。Stripe の設定画面から戻ってくる先なので、
// バックエンドの services/payments.py の PAYOUT_SETTINGS_PATH と揃える
export const PAYOUT_SETTINGS_PATH = '/manage/payout'
// Stripe の設定画面の URL の期限が切れたときに付いて戻ってくるクエリ(バックエンドの refresh_url と揃える)
export const PAYOUT_LINK_EXPIRED_PARAM = 'refresh'

// 移動してよい Stripe の画面のホスト(受け取り設定・ダッシュボード・Checkout)
const STRIPE_HOST_SUFFIX = '.stripe.com'

// API から受け取った Stripe の画面の URL が、https の Stripe のページか確かめる。
// 外部へ移動する前の確認として、不具合などで別のサイトや javascript: の URL が来ても開かないようにする
export function isStripeRedirectUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname.endsWith(STRIPE_HOST_SUFFIX)
  } catch {
    return false
  }
}
