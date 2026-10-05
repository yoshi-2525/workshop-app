import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LIST_STATE,
  parseMaxPriceInput,
  readListState,
  toApiParams,
  toSearchParams,
  validateDateRange,
  type WorkshopListState,
} from '@/utils/workshopListState'

afterEach(() => {
  vi.useRealTimers()
})

describe('readListState', () => {
  it('パラメータがなければ既定値', () => {
    expect(readListState(new URLSearchParams())).toEqual(DEFAULT_LIST_STATE)
  })

  it('不正な値は無視して既定値に戻す', () => {
    const state = readListState(
      new URLSearchParams({
        location_type: 'space',
        price: 'expensive',
        sort: 'random',
        page: '-3',
        date: 'yesterday',
      }),
    )
    expect(state).toEqual(DEFAULT_LIST_STATE)
  })

  it('上限金額は有料のときだけ、範囲内の整数だけ使う', () => {
    expect(readListState(new URLSearchParams({ price: 'paid', max_price: '3000' })).maxPrice).toBe(3000)
    expect(readListState(new URLSearchParams({ price: 'free', max_price: '3000' })).maxPrice).toBeUndefined()
    expect(readListState(new URLSearchParams({ price: 'paid', max_price: '1.5' })).maxPrice).toBeUndefined()
    expect(readListState(new URLSearchParams({ price: 'paid', max_price: '999999999' })).maxPrice).toBeUndefined()
  })

  it('期間指定は日付の形式と前後を確かめ、どちらもなければ指定なしにする', () => {
    const ok = readListState(new URLSearchParams({ date: 'range', from: '2026-10-01', to: '2026-10-05' }))
    expect([ok.date, ok.from, ok.to]).toEqual(['range', '2026-10-01', '2026-10-05'])

    const reversed = readListState(new URLSearchParams({ date: 'range', from: '2026-10-05', to: '2026-10-01' }))
    expect([reversed.date, reversed.from, reversed.to]).toEqual(['range', '2026-10-05', ''])

    const invalid = readListState(new URLSearchParams({ date: 'range', from: '10/1', to: 'x' }))
    expect(invalid.date).toBe('all')
  })

  it('キーワードは前後の空白を除き、上限の長さで切る', () => {
    expect(readListState(new URLSearchParams({ q: '  対話  ' })).q).toBe('対話')
    expect(readListState(new URLSearchParams({ q: 'あ'.repeat(150) })).q).toHaveLength(100)
  })
})

describe('toSearchParams', () => {
  it('既定値の項目は URL に出さない', () => {
    expect(toSearchParams(DEFAULT_LIST_STATE).toString()).toBe('')
  })

  it('readListState と往復して同じ状態に戻る', () => {
    const state: WorkshopListState = {
      q: '哲学',
      locationType: 'online',
      price: 'paid',
      maxPrice: 2000,
      date: 'range',
      from: '2026-10-01',
      to: '2026-10-31',
      available: true,
      sort: 'price',
      page: 3,
    }
    expect(readListState(toSearchParams(state))).toEqual(state)
  })
})

describe('入力チェック', () => {
  it('parseMaxPriceInput', () => {
    expect(parseMaxPriceInput('')).toEqual({ value: undefined })
    expect(parseMaxPriceInput('500')).toEqual({ value: 500 })
    expect(parseMaxPriceInput('-1')).toHaveProperty('error')
    expect(parseMaxPriceInput('abc')).toHaveProperty('error')
  })

  it('validateDateRange', () => {
    expect(validateDateRange('', '')).not.toBeNull()
    expect(validateDateRange('2026-10-01', '')).toBeNull()
    expect(validateDateRange('2026-10-05', '2026-10-01')).not.toBeNull()
    expect(validateDateRange('2026/10/01', '')).not.toBeNull()
  })
})

describe('toApiParams', () => {
  it('自分の予約済み・主催のものは常に除き、既定値の条件は送らない', () => {
    expect(toApiParams(DEFAULT_LIST_STATE)).toEqual({
      q: undefined,
      location_type: undefined,
      price: undefined,
      max_price: undefined,
      available: undefined,
      exclude_reserved: true,
      exclude_own: true,
      sort: 'start',
    })
  })

  it('「明日」は端末の時間帯の明日0時から明後日0時まで', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 4, 15, 30))
    const params = toApiParams({ ...DEFAULT_LIST_STATE, date: 'tomorrow' })
    expect(params.start_from).toBe(new Date(2026, 9, 5).toISOString())
    expect(params.start_to).toBe(new Date(2026, 9, 6).toISOString())
  })

  it('以前の URL の date=today は「すべて」として扱う', () => {
    expect(readListState(new URLSearchParams('date=today')).date).toBe('all')
  })

  it('期間指定の終了日は、その日の終わりまでを含む', () => {
    const params = toApiParams({ ...DEFAULT_LIST_STATE, date: 'range', from: '2026-10-01', to: '2026-10-03' })
    expect(params.start_from).toBe(new Date(2026, 9, 1).toISOString())
    expect(params.start_to).toBe(new Date(2026, 9, 4).toISOString())
  })
})
