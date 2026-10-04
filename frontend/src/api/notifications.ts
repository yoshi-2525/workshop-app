import { apiClient } from '@/api/client'
import type { Notification } from '@/types'

export async function listNotifications(signal?: AbortSignal): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>('/notifications', { signal })
  return data
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count')
  return data.count
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const { data } = await apiClient.post<Notification>(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all')
}
