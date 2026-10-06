import { describe, expect, it } from 'vitest'
import type { BankAccount } from '@/types'
import { bankAccountErrors, earningStatusLabel, formatBankAccount } from '@/utils/payout'

const VALID: BankAccount = {
  bank_name: 'みずほ銀行',
  bank_code: '0001',
  branch_name: '東京営業部',
  branch_code: '001',
  account_type: 'ordinary',
  account_number: '1234567',
  account_holder: 'ヤマダ タロウ',
}

describe('bankAccountErrors', () => {
  it('正しい入力なら誤りはない', () => {
    expect(bankAccountErrors(VALID)).toEqual({})
  })

  it.each([
    ['bank_code', '001'],
    ['bank_code', '00a1'],
    ['branch_code', '0001'],
    ['account_number', '123456'],
    ['account_holder', 'yamada taro'],
    ['account_holder', '山田太郎'],
    ['account_holder', 'ー()'],
    ['bank_name', '  '],
  ] as const)('%s が %s なら誤り', (field, value) => {
    expect(bankAccountErrors({ ...VALID, [field]: value })[field]).toBeTruthy()
  })

  it('口座名義は英大文字と記号も使える', () => {
    expect(bankAccountErrors({ ...VALID, account_holder: 'カ)TAIWA' })).toEqual({})
  })
})

describe('earningStatusLabel', () => {
  it('支払い済みは開催の前後で分ける', () => {
    expect(earningStatusLabel({ status: 'paid', settled: true })).toBe('確定')
    expect(earningStatusLabel({ status: 'paid', settled: false })).toBe('開催前')
  })

  it('返金になったものは受取なし', () => {
    expect(earningStatusLabel({ status: 'refunded', settled: false })).toBe('返金のため受取なし')
    expect(earningStatusLabel({ status: 'refund_pending', settled: false })).toBe('返金のため受取なし')
  })
})

describe('formatBankAccount', () => {
  it('振込に使う項目を1行にまとめる', () => {
    expect(formatBankAccount(VALID)).toBe('みずほ銀行(0001) 東京営業部(001) 普通 1234567 ヤマダ タロウ')
  })
})
