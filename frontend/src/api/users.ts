import { apiClient, fileFormData } from '@/api/client'
import type { FacilitatorProfile, User } from '@/types'

export interface UpdateMePayload {
  name?: string
  bio?: string
}

export async function getFacilitatorProfile(userId: number, signal?: AbortSignal): Promise<FacilitatorProfile> {
  const { data } = await apiClient.get<FacilitatorProfile>(`/facilitators/${userId}`, { signal })
  return data
}

export async function updateMe(payload: UpdateMePayload): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me', payload)
  return data
}

export async function uploadMyAvatar(file: File): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/me/avatar', fileFormData(file))
  return data
}

export async function deleteMyAvatar(): Promise<User> {
  const { data } = await apiClient.delete<User>('/auth/me/avatar')
  return data
}
