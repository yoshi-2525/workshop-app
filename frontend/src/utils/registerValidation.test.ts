import { describe, expect, it } from 'vitest'
import {
  PASSWORD_CHARS_MESSAGE,
  passwordCharsError,
  passwordConfirmError,
  validateRegisterForm,
} from '@/utils/registerValidation'

const valid = { name: '山田', password: 'password123', passwordConfirm: 'password123', agreed: true }

describe('passwordCharsError', () => {
  it.each(['', 'password123', 'p@ss!word~'])('%s は使える', (password) => {
    expect(passwordCharsError(password)).toBeNull()
  })

  it.each(['pass word', 'パスワード123', 'ｐａｓｓ'])('%s は使えない', (password) => {
    expect(passwordCharsError(password)).toBe(PASSWORD_CHARS_MESSAGE)
  })
})

describe('passwordConfirmError', () => {
  it('確認用が空のうちは知らせない', () => {
    expect(passwordConfirmError('password123', '')).toBeNull()
  })

  it('一致すれば null、一致しなければメッセージ', () => {
    expect(passwordConfirmError('password123', 'password123')).toBeNull()
    expect(passwordConfirmError('password123', 'password12')).toBe('パスワードが一致しません')
  })
})

describe('validateRegisterForm', () => {
  it('誤りがなければ null', () => {
    expect(validateRegisterForm(valid, '利用規約')).toBeNull()
  })

  it('空白だけの名前は通さない', () => {
    expect(validateRegisterForm({ ...valid, name: '  ' }, '利用規約')).toBe('名前を入力してください')
  })

  it('パスワードの不一致', () => {
    expect(validateRegisterForm({ ...valid, passwordConfirm: 'other' }, '利用規約')).toBe(
      'パスワードと確認用のパスワードが一致しません',
    )
  })

  it('規約に同意していない', () => {
    expect(validateRegisterForm({ ...valid, agreed: false }, '利用規約と主催者ガイドライン')).toBe(
      '利用規約と主催者ガイドラインに同意してください',
    )
  })

  it('使えない文字を含むパスワード', () => {
    const password = 'パスワード1234'
    expect(validateRegisterForm({ ...valid, password, passwordConfirm: password }, '利用規約')).toBe(
      PASSWORD_CHARS_MESSAGE,
    )
  })
})
