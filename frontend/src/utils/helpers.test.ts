import { describe, expect, it } from 'vitest'
import { getDayInfo, parseDateInput, toDateInputValue, toDateTimeInputValue } from '@/utils/date'
import { formatDateTime, formatPrice, formatPriceYen, formatTime, formatYen } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { canManageWorkshops, followButtonMode } from '@/utils/user'

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

describe('followButtonMode', () => {
  const facilitator = { id: 10, role: 'facilitator' as const }

  it('未ログインならログインへの案内を出す', () => {
    expect(followButtonMode(null, facilitator)).toBe('login')
  })

  it('ほかのユーザーにはフォローボタンを出す', () => {
    expect(followButtonMode({ id: 1 }, facilitator)).toBe('toggle')
  })

  it('自分自身のページには出さない', () => {
    expect(followButtonMode({ id: 10 }, facilitator)).toBe('hidden')
  })

  it('閲覧者の役割にかかわらず、ほかの主催者はフォローできる', () => {
    expect(followButtonMode({ id: 2 }, facilitator)).toBe('toggle')
  })

  it('主催者でない人のページには出さない', () => {
    expect(followButtonMode({ id: 1 }, { id: 30, role: 'participant' })).toBe('hidden')
  })

  it('運営のページには、ログインの有無にかかわらず出さない', () => {
    expect(followButtonMode(null, { id: 20, role: 'admin' })).toBe('hidden')
    expect(followButtonMode({ id: 1 }, { id: 20, role: 'admin' })).toBe('hidden')
  })
})

describe('formatYen', () => {
  it('0円も「無料」と言い換えずに出す', () => {
    expect(formatYen(0)).toBe('0円')
    expect(formatYen(2592)).toBe('2,592円')
  })
})
