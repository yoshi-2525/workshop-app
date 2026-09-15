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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
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
