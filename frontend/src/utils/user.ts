import type { User } from '@/types'

// バックエンドの schemas/user.py の上限と揃える
export const USER_NAME_MAX_LENGTH = 255
export const USER_BIO_MAX_LENGTH = 2000
export const PASSWORD_MIN_LENGTH = 8
// bcrypt が使うのは先頭 72 バイトまで。パスワードは半角文字だけなので、1文字1バイトとして文字数で数えられる
export const PASSWORD_MAX_LENGTH = 72
// パスワードに使える文字: 半角英数字と記号(スペースを除く ASCII の印字可能文字)。全角文字は使えない
export const PASSWORD_PATTERN = /^[\x21-\x7e]*$/

// ワークショップを作成・管理できるか(主催者と、主催者の代わりに作成もできる運営)
export function canManageWorkshops(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'facilitator'
}
