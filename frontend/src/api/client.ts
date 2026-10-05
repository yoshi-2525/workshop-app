import type { Page } from '@/types'
import axios from 'axios'
import { readStorage, writeStorage } from '@/utils/storage'

const TOKEN_STORAGE_KEY = 'workshop_app_token'

// ログイン中のトークン。このブラウザの localStorage に保存する
export const tokenStore = {
  get: (): string | null => readStorage('local', TOKEN_STORAGE_KEY),
  set: (token: string) => writeStorage('local', TOKEN_STORAGE_KEY, token),
  clear: () => writeStorage('local', TOKEN_STORAGE_KEY, null),
}

export const apiClient = axios.create({
  baseURL: '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get()
  // 呼び出し側で指定済み(ログイン直後の役割確認など)なら、保存済みのトークンで上書きしない
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// トークンが無効(期限切れなど)になったことを AuthContext に知らせるイベント
export const AUTH_EXPIRED_EVENT = 'workshop_app:auth_expired'

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // トークンを付けて送ったリクエストだけが対象(ログイン失敗の 401 は含めない)。
      // 送信後に別のアカウントでログインし直していた場合は、新しいトークンを消さない
      const sentAuth = error.config?.headers?.Authorization
      const currentToken = tokenStore.get()
      if (currentToken && sentAuth === `Bearer ${currentToken}`) {
        tokenStore.clear()
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      }
    }
    return Promise.reject(error)
  },
)

// ファイルを1つ送る multipart の本文(フィールド名は file)。
// Content-Type は指定しない(FormData なら、ブラウザが境界文字列つきで自動で付ける)
export function fileFormData(file: File): FormData {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export function extractErrorMessage(error: unknown, fallback = 'エラーが発生しました'): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
      return detail.map((d: { msg: string }) => d.msg).join(', ')
    }
  }
  return fallback
}

// 一覧 API の1ページ分を取得する。総件数はバックエンドが X-Total-Count ヘッダーで返す
export async function fetchPage<T>(
  url: string,
  params: Record<string, unknown>,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Page<T>> {
  const { data, headers } = await apiClient.get<T[]>(url, {
    params: { ...params, limit: perPage, offset: (page - 1) * perPage },
    signal,
  })
  const total = Number(headers['x-total-count'])
  return { items: data, total: Number.isFinite(total) ? total : data.length }
}
