import { apiClient } from '@/api/client'
import type { AttendanceStatus, Reservation, ReservationCreate, ReservationCreateResult } from '@/types'
import { isStripeRedirectUrl } from '@/utils/payment'

export async function listMyReservations(signal?: AbortSignal): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>('/reservations/me', { signal })
  return data
}

export async function listWorkshopReservations(workshopId: number, signal?: AbortSignal): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>(`/workshops/${workshopId}/reservations`, { signal })
  return data
}

// 予約する。オンライン決済なら checkout_url(Stripe の支払い画面)が返り、支払いが済むと予約が確定する。
// 支払い待ちのまま呼ぶと、同じ支払いの画面が返る(支払いの再開)
export async function reserveWorkshop(
  workshopId: number,
  payload: ReservationCreate,
): Promise<ReservationCreateResult> {
  const { data } = await apiClient.post<ReservationCreateResult>(`/workshops/${workshopId}/reservations`, payload)
  // 移動先が Stripe のページでなければ、移動せずにエラーとして扱う
  if (data.checkout_url !== null && !isStripeRedirectUrl(data.checkout_url)) {
    throw new Error('Stripe の支払い画面の URL を受け取れませんでした')
  }
  return data
}

// 自分の予約。支払い待ちなら、バックエンドが Stripe から支払いの状態を読み直してから返す
export async function getMyReservation(reservationId: number, signal?: AbortSignal): Promise<Reservation> {
  const { data } = await apiClient.get<Reservation>(`/reservations/${reservationId}`, { signal })
  return data
}

// オンライン決済の支払いをやめる。確保していた席はすぐ空く
export async function abandonPayment(reservationId: number): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/reservations/${reservationId}/abandon-payment`)
  return data
}

// 参加者は自分で予約をキャンセルできない。キャンセルはワークショップの主催者(と運営)だけが行える
export async function cancelWorkshopReservation(workshopId: number, reservationId: number): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/workshops/${workshopId}/reservations/${reservationId}/cancel`)
  return data
}

export async function updateReservationAttendance(
  workshopId: number,
  reservationId: number,
  attendance: AttendanceStatus,
): Promise<Reservation> {
  const { data } = await apiClient.put<Reservation>(
    `/workshops/${workshopId}/reservations/${reservationId}/attendance`,
    { attendance },
  )
  return data
}
