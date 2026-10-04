import { apiClient } from '@/api/client'
import type { Workshop } from '@/types'

export async function listMyFavorites(signal?: AbortSignal): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/favorites', { signal })
  return data
}

export async function addFavorite(workshopId: number): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>(`/workshops/${workshopId}/favorite`)
  return data
}

export async function removeFavorite(workshopId: number): Promise<void> {
  await apiClient.delete(`/workshops/${workshopId}/favorite`)
}
