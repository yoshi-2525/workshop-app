import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'workshop_app_token'

export const apiClient = axios.create({
  baseURL: '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
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
      const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (currentToken && sentAuth === `Bearer ${currentToken}`) {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      }
    }
    return Promise.reject(error)
  },
)

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
