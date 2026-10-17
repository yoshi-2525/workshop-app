import type { ListWorkshopsParams, LocationType, WorkshopSort } from '@/types'
import { addDays, parseDateInput } from '@/utils/date'
import { WORKSHOP_PRICE_MAX } from '@/utils/workshop'
import { readStorage, writeStorage } from '@/utils/storage'

// ワークショップ一覧の検索条件・並び替え・ページ番号は URL のクエリに持たせる。
// 詳細ページから戻ったときやブラウザの「戻る」、再読み込みでも同じ状態を表示できるようにするため

export type LocationTypeFilter = 'all' | LocationType
export type PriceFilter = 'all' | 'free' | 'paid'
// 当日のワークショップは予約の受付が終わっているので、「今日」の絞り込みは設けない
export type DateFilter = 'all' | 'tomorrow' | 'week' | 'range'

export interface WorkshopListState {
  q: string
  locationType: LocationTypeFilter
  price: PriceFilter
  // 参加費の上限(円)。price が free 以外のときに使う(無料のものも含めて、この金額以下)
  maxPrice: number | undefined
  date: DateFilter
  // date が range のときの期間(YYYY-MM-DD)。片方だけでもよい
  from: string
  to: string
  available: boolean
  sort: WorkshopSort
  page: number
}

// バックエンドの schemas/workshop.py の WorkshopSearchQuery.q と揃える
export const KEYWORD_MAX_LENGTH = 100
export const DEFAULT_LIST_STATE: WorkshopListState = {
  q: '',
  locationType: 'all',
  price: 'all',
  maxPrice: undefined,
  date: 'all',
  from: '',
  to: '',
  available: false,
  sort: 'start',
  page: 1,
}

// 検索欄の条件(キーワード・開催日・開催形式・参加費)のどれかを指定しているか。参加可能・並び替え・ページは含めない
export function hasSearchConditions(state: WorkshopListState): boolean {
  return (
    state.q !== DEFAULT_LIST_STATE.q ||
    state.locationType !== DEFAULT_LIST_STATE.locationType ||
    state.price !== DEFAULT_LIST_STATE.price ||
    state.maxPrice !== DEFAULT_LIST_STATE.maxPrice ||
    state.date !== DEFAULT_LIST_STATE.date
  )
}

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// 以前の URL の date=today などの、今は使わない値は「すべて」として扱う
const DATE_FILTERS: DateFilter[] = ['all', 'tomorrow', 'week', 'range']
const SORTS: WorkshopSort[] = ['start', 'newest', 'price']

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

// 上限金額として使える値か(参加費はこれより高く設定できないので、上限金額もこの範囲で受け付ける)
function isValidMaxPrice(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= WORKSHOP_PRICE_MAX
}

// 期間指定(YYYY-MM-DD、片方だけでもよい)を「10/16〜10/20」の形で表す。指定のない側は空にする
export function dateRangeLabel(from: string, to: string): string {
  const monthDay = (value: string) => {
    if (!value) return ''
    const date = parseDateInput(value)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  return `${monthDay(from)}〜${monthDay(to)}`
}

// URL は手で書き換えられるので、不正な値は無視して既定値に戻す
export function readListState(params: URLSearchParams): WorkshopListState {
  const price = pick(params.get('price'), ['all', 'free', 'paid'] as const, 'all')
  const maxPriceRaw = Number(params.get('max_price'))
  // 上限金額は「無料のみ」以外のときに使う(以前の URL の price=paid&max_price=... もそのまま読める)
  const maxPrice =
    price !== 'free' && params.get('max_price') !== null && isValidMaxPrice(maxPriceRaw) ? maxPriceRaw : undefined

  let date = pick(params.get('date'), DATE_FILTERS, 'all')
  let from = ''
  let to = ''
  if (date === 'range') {
    const rawFrom = params.get('from') ?? ''
    const rawTo = params.get('to') ?? ''
    from = DATE_INPUT_PATTERN.test(rawFrom) ? rawFrom : ''
    to = DATE_INPUT_PATTERN.test(rawTo) ? rawTo : ''
    if (from && to && to < from) to = ''
    if (!from && !to) date = 'all'
  }

  const page = Number(params.get('page'))
  return {
    q: (params.get('q') ?? '').trim().slice(0, KEYWORD_MAX_LENGTH),
    locationType: pick(params.get('location_type'), ['all', 'online', 'offline'] as const, 'all'),
    price,
    maxPrice,
    date,
    from,
    to,
    available: params.get('available') === '1',
    sort: pick(params.get('sort'), SORTS, 'start'),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  }
}

// 既定値の項目は URL に出さない(トップは「/」のまま)
export function toSearchParams(state: WorkshopListState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.locationType !== 'all') params.set('location_type', state.locationType)
  if (state.price !== 'all') params.set('price', state.price)
  if (state.price !== 'free' && state.maxPrice !== undefined) params.set('max_price', String(state.maxPrice))
  if (state.date !== 'all') params.set('date', state.date)
  if (state.date === 'range') {
    if (state.from) params.set('from', state.from)
    if (state.to) params.set('to', state.to)
  }
  if (state.available) params.set('available', '1')
  if (state.sort !== 'start') params.set('sort', state.sort)
  if (state.page > 1) params.set('page', String(state.page))
  return params
}

// 端末の時間帯での日付の区切り(0時)を基準に、開催日時の範囲 [start_from, start_to) を返す。
// 「明日」などは一覧を表示した時点の日付で決まる。期間の終了日はその日の終わりまでを含む
function startRangeFor(state: WorkshopListState, now = new Date()): Pick<ListWorkshopsParams, 'start_from' | 'start_to'> {
  const today = addDays(now, 0)
  switch (state.date) {
    case 'all':
      return {}
    case 'tomorrow':
      return { start_from: addDays(today, 1).toISOString(), start_to: addDays(today, 2).toISOString() }
    case 'week':
      // 今日を含む7日間
      return { start_from: today.toISOString(), start_to: addDays(today, 7).toISOString() }
    case 'range':
      return {
        start_from: state.from ? parseDateInput(state.from).toISOString() : undefined,
        start_to: state.to ? addDays(parseDateInput(state.to), 1).toISOString() : undefined,
      }
  }
}

export function toApiParams(state: WorkshopListState): ListWorkshopsParams {
  return {
    q: state.q || undefined,
    location_type: state.locationType === 'all' ? undefined : state.locationType,
    price: state.price === 'all' ? undefined : state.price,
    max_price: state.price !== 'free' ? state.maxPrice : undefined,
    available: state.available || undefined,
    // 予約済みのワークショップは一覧に出さない(予約は「予約履歴・参加履歴」から確認する)
    exclude_reserved: true,
    // 自分が主催するワークショップも出さない(「ワークショップ管理」から確認する)
    exclude_own: true,
    sort: state.sort,
    ...startRangeFor(state),
  }
}

// --- 詳細ページから一覧へ戻るための情報(このタブの sessionStorage に保存する) ---

const LAST_LIST_URL_KEY = 'workshop_list:last_url'
const SCROLL_KEY = 'workshop_list:scroll'
// 保存しておく一覧 URL の数の上限(古いものから捨てる)
const MAX_SCROLL_ENTRIES = 20

export function saveLastListUrl(url: string) {
  writeStorage('session', LAST_LIST_URL_KEY, url)
}

// 最後に表示していた一覧の URL。一覧を開いていなければトップ
export function getLastListUrl(): string {
  const url = readStorage('session', LAST_LIST_URL_KEY)
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/'
}

function readScrollMap(): Record<string, number> {
  try {
    const data: unknown = JSON.parse(readStorage('session', SCROLL_KEY) ?? '{}')
    return typeof data === 'object' && data !== null ? (data as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function saveListScroll(url: string, y: number) {
  const map = readScrollMap()
  delete map[url]
  map[url] = Math.max(0, Math.round(y))
  const keys = Object.keys(map)
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SCROLL_ENTRIES))) delete map[key]
  writeStorage('session', SCROLL_KEY, JSON.stringify(map))
}

export function getListScroll(url: string): number | null {
  const y = readScrollMap()[url]
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}
