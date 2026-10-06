import { apiClient, fetchPage } from '@/api/client'
import type {
  AdminPayoutRequest,
  BankAccount,
  Earning,
  Page,
  PayoutRequest,
  PayoutRequestStatus,
  PayoutSummary,
} from '@/types'

const BASE = '/facilitators/me/payouts'

// 振込を申請できる額・開催前の額などの、主催者の売上の状況
export async function getPayoutSummary(signal?: AbortSignal): Promise<PayoutSummary> {
  const { data } = await apiClient.get<PayoutSummary>(`${BASE}/summary`, { signal })
  return data
}

// 収入の明細(オンライン決済の支払いごと)
export function getEarnings(page: number, perPage: number, signal?: AbortSignal): Promise<Page<Earning>> {
  return fetchPage(`${BASE}/earnings`, {}, page, perPage, signal)
}

// 登録している振込先口座。未登録なら null
export async function getBankAccount(signal?: AbortSignal): Promise<BankAccount | null> {
  const { data } = await apiClient.get<BankAccount | null>(`${BASE}/bank-account`, { signal })
  return data
}

export async function saveBankAccount(account: BankAccount): Promise<BankAccount> {
  const { data } = await apiClient.put<BankAccount>(`${BASE}/bank-account`, account)
  return data
}

// 自分の振込の申請の履歴(新しい順)
export function getPayoutRequests(page: number, perPage: number, signal?: AbortSignal): Promise<Page<PayoutRequest>> {
  return fetchPage(`${BASE}/requests`, {}, page, perPage, signal)
}

// 申請できる額の全額で振込を申請する
export async function requestPayout(): Promise<PayoutRequest> {
  const { data } = await apiClient.post<PayoutRequest>(`${BASE}/requests`)
  return data
}

// ---- 運営(admin)向け ----

export function getAdminPayoutRequests(
  status: PayoutRequestStatus | null,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Page<AdminPayoutRequest>> {
  return fetchPage('/admin/payout-requests', status ? { status } : {}, page, perPage, signal)
}

export async function markPayoutPaid(id: number, note: string): Promise<AdminPayoutRequest> {
  const { data } = await apiClient.post<AdminPayoutRequest>(`/admin/payout-requests/${id}/paid`, { note })
  return data
}

export async function rejectPayout(id: number, note: string): Promise<AdminPayoutRequest> {
  const { data } = await apiClient.post<AdminPayoutRequest>(`/admin/payout-requests/${id}/reject`, { note })
  return data
}
