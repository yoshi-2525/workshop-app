import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage, VALIDATION_ERROR_MESSAGE } from '@/api/client'

function apiError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse
  return new AxiosError('Request failed', String(status), undefined, undefined, response)
}

describe('extractErrorMessage', () => {
  it('文字列の detail はそのまま返す', () => {
    expect(extractErrorMessage(apiError(409, { detail: '満員のため予約できません' }), 'fallback')).toBe(
      '満員のため予約できません',
    )
  })

  it('422 のうち、日本語のメッセージだけを返す', () => {
    const error = apiError(422, {
      detail: [
        { type: 'password_invalid_characters', msg: 'パスワードは半角英数字と記号で入力してください' },
        { type: 'string_too_short', msg: 'String should have at least 1 character' },
      ],
    })
    expect(extractErrorMessage(error, 'fallback')).toBe('パスワードは半角英数字と記号で入力してください')
  })

  it('ValueError の「Value error, 」は取り除き、同じメッセージは1つにまとめる', () => {
    const error = apiError(422, {
      detail: [
        { type: 'value_error', msg: 'Value error, 終了日時は開始日時より後にしてください' },
        { type: 'value_error', msg: 'Value error, 終了日時は開始日時より後にしてください' },
      ],
    })
    expect(extractErrorMessage(error, 'fallback')).toBe('終了日時は開始日時より後にしてください')
  })

  it('422 が英語のメッセージだけなら、日本語の決まった文言にする', () => {
    const error = apiError(422, {
      detail: [{ type: 'value_error', msg: 'value is not a valid email address: An email address must have a period.' }],
    })
    expect(extractErrorMessage(error, 'fallback')).toBe(VALIDATION_ERROR_MESSAGE)
  })

  it('detail がなければ fallback を返す', () => {
    expect(extractErrorMessage(apiError(500, {}), 'fallback')).toBe('fallback')
    expect(extractErrorMessage(new Error('x'), 'fallback')).toBe('fallback')
  })
})
