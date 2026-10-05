import { apiClient } from '@/api/client'
import type { PayoutAccount } from '@/types'
import { isStripeRedirectUrl } from '@/utils/payment'

interface RedirectUrl {
  url: string
}

// 移動先が Stripe のページでなければ、移動せずにエラーとして扱う
function toStripeRedirectUrl(data: RedirectUrl): string {
  if (!isStripeRedirectUrl(data.url)) throw new Error('Stripe の画面の URL を受け取れませんでした')
  return data.url
}

export async function getPayoutAccount(signal?: AbortSignal): Promise<PayoutAccount> {
  const { data } = await apiClient.get<PayoutAccount>('/facilitators/me/payout-account', { signal })
  return data
}

// 受け取り設定(本人確認・口座登録)を行う Stripe の画面の URL。一度しか使えないので、取得したらすぐ移動する
export async function startPayoutOnboarding(): Promise<string> {
  const { data } = await apiClient.post<RedirectUrl>('/facilitators/me/payout-account/onboarding')
  return toStripeRedirectUrl(data)
}

// 売上・入金を確認する Stripe のダッシュボードの URL
export async function getPayoutDashboardUrl(): Promise<string> {
  const { data } = await apiClient.post<RedirectUrl>('/facilitators/me/payout-account/dashboard')
  return toStripeRedirectUrl(data)
}
