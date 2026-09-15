import { apiClient } from './client'
import type { Workshop, WorkshopInput } from '../types'

export async function listWorkshops(params?: {
  mine?: boolean
  facilitator_id?: number
}): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/workshops', { params })
  return data
}

export async function addFavorite(workshopId: number): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>(`/workshops/${workshopId}/favorite`)
  return data
}

export async function removeFavorite(workshopId: number): Promise<void> {
  await apiClient.delete(`/workshops/${workshopId}/favorite`)
}

export async function getWorkshop(id: number): Promise<Workshop> {
  const { data } = await apiClient.get<Workshop>(`/workshops/${id}`)
  return data
}

export async function createWorkshop(payload: WorkshopInput): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>('/workshops', payload)
  return data
}

export async function updateWorkshop(id: number, payload: WorkshopInput): Promise<Workshop> {
  const { data } = await apiClient.put<Workshop>(`/workshops/${id}`, payload)
  return data
}

export async function deleteWorkshop(id: number): Promise<void> {
  await apiClient.delete(`/workshops/${id}`)
}

export async function uploadWorkshopImage(id: number, file: File): Promise<Workshop> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<Workshop>(`/workshops/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteWorkshopImage(id: number): Promise<Workshop> {
  const { data } = await apiClient.delete<Workshop>(`/workshops/${id}/image`)
  return data
}
