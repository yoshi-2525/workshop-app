// バックエンドの schemas/user.py の上限と揃える
export const USER_NAME_MAX_LENGTH = 255
export const USER_BIO_MAX_LENGTH = 2000
export const PASSWORD_MIN_LENGTH = 8
// bcrypt が使うのは先頭 72 バイトまで。日本語などは1文字3バイトになるので、文字数ではなくバイト数で数える
export const PASSWORD_MAX_BYTES = 72

// 主催者アイコンとして受け付ける形式と大きさ(バックエンドの services/uploads.py と config.py に揃える)
export const AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const AVATAR_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
