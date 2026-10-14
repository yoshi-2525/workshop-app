import type { SelfRegisterRole } from '@/types'

// ログイン・新規登録の画面で使う、役割の表示名
export const ROLE_LABEL: Record<SelfRegisterRole, string> = {
  participant: '参加者',
  facilitator: '主催者',
}
