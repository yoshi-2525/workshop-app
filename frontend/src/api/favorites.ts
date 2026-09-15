import { apiClient } from './client'
import type { Workshop } from '../types'

export async function listMyFavorites(): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/favorites')
  return data
}
