import { apiClient } from '@/api/client'
import type { InquiryDetail, InquirySummary } from '@/types'

export async function listInquiries(workshopId?: number, signal?: AbortSignal): Promise<InquirySummary[]> {
  const { data } = await apiClient.get<InquirySummary[]>('/inquiries', {
    params: workshopId === undefined ? undefined : { workshop_id: workshopId },
    signal,
  })
  return data
}

export async function getInquiryUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/inquiries/unread-count')
  return data.count
}

export async function getInquiry(id: number, signal?: AbortSignal): Promise<InquiryDetail> {
  const { data } = await apiClient.get<InquiryDetail>(`/inquiries/${id}`, { signal })
  return data
}

export async function markInquiryRead(id: number): Promise<void> {
  await apiClient.post(`/inquiries/${id}/read`)
}

export async function replyInquiry(id: number, body: string): Promise<InquiryDetail> {
  const { data } = await apiClient.post<InquiryDetail>(`/inquiries/${id}/messages`, { body })
  return data
}

// このワークショップについて自分が問い合わせたやり取り。まだなければ null
export async function getWorkshopInquiry(workshopId: number, signal?: AbortSignal): Promise<InquiryDetail | null> {
  const { data } = await apiClient.get<InquiryDetail | null>(`/workshops/${workshopId}/inquiry`, { signal })
  return data
}

// 主催者に問い合わせる。初めてならやり取りが作られ、既にあればそこに追加される
export async function sendWorkshopInquiry(workshopId: number, body: string): Promise<InquiryDetail> {
  const { data } = await apiClient.post<InquiryDetail>(`/workshops/${workshopId}/inquiry/messages`, { body })
  return data
}
