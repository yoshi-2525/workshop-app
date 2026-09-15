import { apiClient } from './client'
import type { SelfRegisterRole, User } from '../types'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role: SelfRegisterRole
}

interface TokenResponse {
  access_token: string
  token_type: string
}

export async function login(payload: LoginPayload): Promise<string> {
  const form = new URLSearchParams()
  form.set('username', payload.email)
  form.set('password', payload.password)
  const { data } = await apiClient.post<TokenResponse>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data.access_token
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/register', payload)
  return data
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}
