import { apiClient } from '@/api/client'
import type { Workshop } from '@/types'

export async function listMyFavorites(signal?: AbortSignal): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/favorites', { signal })
  return data
}
