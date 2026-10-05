import { apiClient, fetchPage } from '@/api/client'
import type { WorkshopSort } from '@/api/workshops'
import type { FacilitatorProfile, Page, Workshop } from '@/types'

export async function followFacilitator(facilitatorId: number): Promise<void> {
  await apiClient.post(`/facilitators/${facilitatorId}/follow`)
}

export async function unfollowFacilitator(facilitatorId: number): Promise<void> {
  await apiClient.delete(`/facilitators/${facilitatorId}/follow`)
}

// フォロー中の主催者(新しくフォローした順)
export function listFollowedFacilitators(
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Page<FacilitatorProfile>> {
  return fetchPage('/follows/facilitators', {}, page, perPage, signal)
}

// フォロー中の主催者の、開催予定のワークショップ。並び順は公開一覧と同じ
export function listFollowedWorkshops(
  sort: WorkshopSort,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Page<Workshop>> {
  return fetchPage('/follows/workshops', { sort }, page, perPage, signal)
}
