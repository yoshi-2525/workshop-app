import { apiClient } from './client'
import type { LocationType, Workshop, WorkshopInput } from '../types'

// start: 開催日時の近い順 / newest: 公開日時の新しい順 / price: 価格の安い順
export type WorkshopSort = 'start' | 'newest' | 'price'

export type ListWorkshopsParams = {
  facilitator_id?: number
  q?: string
  location_type?: LocationType
  price?: 'free' | 'paid'
  max_price?: number
  // true なら満員でない(チケットを購入できる)ものだけ
  available?: boolean
  // true ならログイン中のユーザーが予約済みのものを除く
  exclude_reserved?: boolean
  // true ならログイン中のユーザーが主催するものを除く
  exclude_own?: boolean
  sort?: WorkshopSort
  // 開催日時の範囲 [start_from, start_to)。ISO 8601 形式
  start_from?: string
  start_to?: string
}

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
): Promise<{ items: Workshop[]; total: number }> {
  const { page, perPage, ...filters } = params
  const { data, headers } = await apiClient.get<Workshop[]>('/workshops', {
    params: { ...filters, limit: perPage, offset: (page - 1) * perPage },
    signal,
  })
  const total = Number(headers['x-total-count'])
  return { items: data, total: Number.isFinite(total) ? total : data.length }
}

export async function addFavorite(workshopId: number): Promise<Workshop> {
  const { data } = await apiClient.post<Workshop>(`/workshops/${workshopId}/favorite`)
  return data
}

export async function removeFavorite(workshopId: number): Promise<void> {
  await apiClient.delete(`/workshops/${workshopId}/favorite`)
}

export async function getWorkshop(id: number, signal?: AbortSignal): Promise<Workshop> {
  const { data } = await apiClient.get<Workshop>(`/workshops/${id}`, { signal })
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
  // Content-Type は指定しない(FormData なら、ブラウザが境界文字列つきで自動で付ける)
  const { data } = await apiClient.post<Workshop>(`/workshops/${id}/image`, formData)
  return data
}

export async function deleteWorkshopImage(id: number): Promise<Workshop> {
  const { data } = await apiClient.delete<Workshop>(`/workshops/${id}/image`)
  return data
}
