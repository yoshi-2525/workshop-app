import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeWorkshop } from '@/test/factories'
import {
  getReservationBlocker,
  hasFewSeats,
  isAttendanceOpen,
  isReservationClosed,
  isWorkshopFinished,
  isWorkshopStarted,
  reservationDeadline,
} from '@/utils/workshop'

const NOW = new Date('2026-10-04T12:00:00Z')
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getReservationBlocker', () => {
  it('予約できるなら null', () => {
    expect(getReservationBlocker(makeWorkshop())).toBeNull()
  })

  it.each([
    ['下書き', { status: 'draft' as const }, 'not_published'],
    ['中止', { status: 'canceled' as const }, 'not_published'],
    ['開始済み', { start_at: hoursFromNow(-1) }, 'started'],
    ['締め切り後(開始の24時間前を過ぎた)', { start_at: hoursFromNow(23) }, 'closed'],
    ['満員', { capacity: 5, reserved_count: 5 }, 'full'],
  ])('%s', (_, overrides, expected) => {
    expect(getReservationBlocker(makeWorkshop(overrides))).toBe(expected)
  })

  it('予約済み・キャンセルされたは閲覧者の状態で決まる', () => {
    const viewer = { is_favorited: false, is_reserved: true, is_reservation_canceled: false }
    expect(getReservationBlocker(makeWorkshop({ viewer }))).toBe('reserved')
    expect(
      getReservationBlocker(makeWorkshop({ viewer: { ...viewer, is_reserved: false, is_reservation_canceled: true } })),
    ).toBe('reservation_canceled')
  })

  it('複数当てはまるときは、画面に出す優先順で先のものを返す', () => {
    // 予約済みで満員なら「予約済み」、開始済みなら締め切り後でもあるが「開始済み」
    const viewer = { is_favorited: false, is_reserved: true, is_reservation_canceled: false }
    expect(getReservationBlocker(makeWorkshop({ viewer, capacity: 1, reserved_count: 1 }))).toBe('reserved')
    expect(getReservationBlocker(makeWorkshop({ start_at: hoursFromNow(-1), capacity: 1, reserved_count: 1 }))).toBe(
      'started',
    )
  })
})

describe('日時の判定', () => {
  it('予約の締め切りは開始の24時間前', () => {
    const workshop = makeWorkshop({ start_at: hoursFromNow(48) })
    expect(reservationDeadline(workshop)).toBe(hoursFromNow(24))
    expect(isReservationClosed(makeWorkshop({ start_at: hoursFromNow(24) }))).toBe(true)
    expect(isReservationClosed(makeWorkshop({ start_at: hoursFromNow(25) }))).toBe(false)
  })

  it('出欠は開始の24時間前から記録できる', () => {
    expect(isAttendanceOpen(makeWorkshop({ start_at: hoursFromNow(24) }))).toBe(true)
    expect(isAttendanceOpen(makeWorkshop({ start_at: hoursFromNow(25) }))).toBe(false)
  })

  it('開始済み・開催済み', () => {
    expect(isWorkshopStarted(makeWorkshop({ start_at: hoursFromNow(0) }))).toBe(true)
    expect(isWorkshopFinished(makeWorkshop({ end_at: hoursFromNow(-1) }))).toBe(true)
    expect(isWorkshopFinished(makeWorkshop({ end_at: hoursFromNow(1) }))).toBe(false)
  })
})

describe('hasFewSeats', () => {
  it('残り1〜5席なら true、満員や6席以上なら false', () => {
    expect(hasFewSeats(makeWorkshop({ capacity: 10, reserved_count: 5 }))).toBe(true)
    expect(hasFewSeats(makeWorkshop({ capacity: 10, reserved_count: 9 }))).toBe(true)
    expect(hasFewSeats(makeWorkshop({ capacity: 10, reserved_count: 10 }))).toBe(false)
    expect(hasFewSeats(makeWorkshop({ capacity: 10, reserved_count: 4 }))).toBe(false)
  })
})
