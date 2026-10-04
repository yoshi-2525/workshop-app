import { apiClient } from '@/api/client'
import type { AttendanceStatus, Reservation, ReservationCreate } from '@/types'

export async function listMyReservations(signal?: AbortSignal): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>('/reservations/me', { signal })
  return data
}

export async function listWorkshopReservations(workshopId: number, signal?: AbortSignal): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>(`/workshops/${workshopId}/reservations`, { signal })
  return data
}

export async function reserveWorkshop(workshopId: number, payload: ReservationCreate): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/workshops/${workshopId}/reservations`, payload)
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
