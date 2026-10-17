import { apiClient, fetchPage, fileFormData } from '@/api/client'
import type { ListWorkshopsParams, Page, RelatedWorkshops, Workshop, WorkshopInput } from '@/types'

export async function listWorkshops(
  params?: ListWorkshopsParams,
  signal?: AbortSignal,
): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/workshops', { params, signal })
  return data
}

// 主催者・管理者が管理するワークショップ(下書き・中止を含む。admin は全員分)
export async function listManagedWorkshops(signal?: AbortSignal): Promise<Workshop[]> {
  const { data } = await apiClient.get<Workshop[]>('/manage/workshops', { signal })
  return data
}

// 1ページ分のワークショップと、絞り込み条件に一致する総件数を返す
export async function listWorkshopsPage(
  params: ListWorkshopsParams & { page: number; perPage: number },
  signal?: AbortSignal,
): Promise<Page<Workshop>> {
  const { page, perPage, ...filters } = params
  return fetchPage('/workshops', filters, page, perPage, signal)
}

export async function getWorkshop(id: number, signal?: AbortSignal): Promise<Workshop> {
  const { data } = await apiClient.get<Workshop>(`/workshops/${id}`, { signal })
  return data
}

// 同じ主催者・類似・近くで開催する、開催予定のワークショップ
export async function getRelatedWorkshops(id: number, signal?: AbortSignal): Promise<RelatedWorkshops> {
  const { data } = await apiClient.get<RelatedWorkshops>(`/workshops/${id}/related`, { signal })
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

// 公開中のワークショップを中止にする。予約済みの参加者には中止のお知らせが届く
export async function cancelWorkshop(id: number): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>(`/workshops/${id}/cancel`)
  return data
}

export async function deleteWorkshop(id: number): Promise<void> {
  await apiClient.delete(`/workshops/${id}`)
}

export async function uploadWorkshopImage(id: number, file: File): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>(`/workshops/${id}/image`, fileFormData(file))
  return data
}

export async function deleteWorkshopImage(id: number): Promise<Workshop> {
  const { data } = await apiClient.delete<Workshop>(`/workshops/${id}/image`)
  return data
}
