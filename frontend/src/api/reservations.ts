import { apiClient } from './client'
import type { Reservation, ReservationCreate } from '../types'

export async function listMyReservations(): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>('/reservations/me')
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

export async function cancelReservation(reservationId: number): Promise<void> {
  await apiClient.delete(`/reservations/${reservationId}`)
}
