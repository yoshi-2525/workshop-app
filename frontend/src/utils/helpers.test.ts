import { describe, expect, it } from 'vitest'
import { getDayInfo, parseDateInput, toDateInputValue, toDateTimeInputValue } from '@/utils/date'
import { formatDateTime, formatPrice, formatPriceYen, formatTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { canManageWorkshops } from '@/utils/user'

describe('parseIdParam', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [undefined, null],
    ['', null],
    ['0', null],
    ['-1', null],
    ['1.5', null],
    ['abc', null],
    ['99999999999999999999', null],
  ])('%s → %s', (input, expected) => {
    expect(parseIdParam(input)).toBe(expected)
  })
})

describe('format', () => {
  it('参加費', () => {
    expect(formatPrice(0)).toBe('無料')
    expect(formatPrice(3000)).toBe('¥3,000')
    expect(formatPriceYen(0)).toBe('無料')
    expect(formatPriceYen(3000)).toBe('3,000円')
  })

  it('不正な日時は「-」', () => {
    expect(formatDateTime('not a date')).toBe('-')
    expect(formatTime('not a date')).toBe('-')
  })
})

describe('date', () => {
  it('YYYY-MM-DD と端末の時間帯の日付を相互に変換する', () => {
    const date = parseDateInput('2026-10-04')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 4, 0])
    expect(toDateInputValue(date)).toBe('2026-10-04')
    expect(toDateTimeInputValue(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
  })

  it('曜日と祝日', () => {
    expect(getDayInfo(parseDateInput('2026-10-05'))).toEqual({ label: '月', kind: 'weekday' })
    expect(getDayInfo(parseDateInput('2026-10-03'))).toEqual({ label: '土', kind: 'saturday' })
    expect(getDayInfo(parseDateInput('2026-10-04'))).toEqual({ label: '日', kind: 'holiday' })
    // 2026-10-12 はスポーツの日(月曜)
    expect(getDayInfo(parseDateInput('2026-10-12'))).toEqual({ label: '月・祝', kind: 'holiday' })
  })
})

describe('canManageWorkshops', () => {
  it('主催者と運営だけ', () => {
    expect(canManageWorkshops({ role: 'facilitator' })).toBe(true)
    expect(canManageWorkshops({ role: 'admin' })).toBe(true)
    expect(canManageWorkshops({ role: 'participant' })).toBe(false)
    expect(canManageWorkshops(null)).toBe(false)
  })
})
