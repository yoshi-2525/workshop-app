import { describe, expect, it } from 'vitest'
import { formatDocumentTitle, pageTitleForPath } from '@/utils/pageTitle'

describe('pageTitleForPath', () => {
  it('固定のパスの名前を返す', () => {
    expect(pageTitleForPath('/help/terms')).toBe('利用規約')
    expect(pageTitleForPath('/manage/payout')).toBe('売上と振込')
  })

  it('パラメータを含むパスにも対応する', () => {
    expect(pageTitleForPath('/workshops/12')).toBe('ワークショップの詳細')
    expect(pageTitleForPath('/workshops/12/reserve')).toBe('参加者情報の入力')
    expect(pageTitleForPath('/reservations/5/payment/complete')).toBe('お支払いの確認')
  })

  it('固定のパスを、パラメータを含むパスより優先する', () => {
    expect(pageTitleForPath('/reservations/complete')).toBe('参加登録の完了')
    expect(pageTitleForPath('/manage/workshops/new')).toBe('ワークショップの新規作成')
  })

  it('トップページや対応表にないパスは null', () => {
    expect(pageTitleForPath('/')).toBeNull()
    expect(pageTitleForPath('/unknown/page')).toBeNull()
  })
})

describe('formatDocumentTitle', () => {
  it('サービス名を後ろに付ける', () => {
    expect(formatDocumentTitle('通知')).toBe('通知 | TAIWA')
  })
})
