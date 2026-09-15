import { apiClient } from './client'
import type { FacilitatorProfile, User } from '../types'

export interface UpdateMePayload {
  name?: string
  bio?: string
}

export async function getFacilitatorProfile(userId: number): Promise<FacilitatorProfile> {
  const { data } = await apiClient.get<FacilitatorProfile>(`/facilitators/${userId}`)
  return data
}

export async function updateMe(payload: UpdateMePayload): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me', payload)
  return data
}
