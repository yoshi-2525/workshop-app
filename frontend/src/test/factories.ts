import type { Workshop } from '@/types'

// テスト用のワークショップ。既定は「公開中・3日後に開始・空席あり・未予約」
export function makeWorkshop(overrides: Partial<Workshop> = {}): Workshop {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return {
    id: 1,
    title: 'テストワークショップ',
    description: '説明',
    image_url: '',
    facilitator_id: 10,
    facilitator_name: '主催者',
    facilitator_avatar_url: '',
    location_type: 'offline',
    location: '東京都渋谷区',
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    capacity: 10,
    price: 0,
    cancellation_policy: '',
    reserved_count: 0,
    status: 'published',
    viewer: { is_favorited: false, is_reserved: false, is_reservation_canceled: false },
    participant_info: null,
    ...overrides,
  }
}
