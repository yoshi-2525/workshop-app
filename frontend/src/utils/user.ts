// バックエンドの schemas/user.py の上限と揃える
export const USER_NAME_MAX_LENGTH = 255
export const USER_BIO_MAX_LENGTH = 2000
export const PASSWORD_MIN_LENGTH = 8
// bcrypt が使うのは先頭 72 バイトまで。日本語などは1文字3バイトになるので、文字数ではなくバイト数で数える
export const PASSWORD_MAX_BYTES = 72

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
