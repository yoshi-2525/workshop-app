import type { ListWorkshopsParams, WorkshopSort } from '@/api/workshops'
import type { LocationType } from '@/types'
import { parseDateInput } from '@/utils/date'
import { WORKSHOP_PRICE_MAX } from '@/utils/workshop'

// ワークショップ一覧の検索条件・並び替え・ページ番号は URL のクエリに持たせる。
// 詳細ページから戻ったときやブラウザの「戻る」、再読み込みでも同じ状態を表示できるようにするため

export type LocationTypeFilter = 'all' | LocationType
export type PriceFilter = 'all' | 'free' | 'paid'
export type DateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'range'

export interface WorkshopListState {
  q: string
  locationType: LocationTypeFilter
  price: PriceFilter
  maxPrice: number | undefined
  date: DateFilter
  // date が range のときの期間(YYYY-MM-DD)。片方だけでもよい
  from: string
  to: string
  available: boolean
  sort: WorkshopSort
  page: number
}

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

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATE_FILTERS: DateFilter[] = ['all', 'today', 'tomorrow', 'week', 'range']
const SORTS: WorkshopSort[] = ['start', 'newest', 'price']

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

// 上限金額として使える値か(参加費はこれより高く設定できないので、上限金額もこの範囲で受け付ける)
function isValidMaxPrice(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= WORKSHOP_PRICE_MAX
}

// --- 検索フォームの入力チェック(URL を読むときと同じ基準で確かめる) ---

// 上限金額の入力欄の値を数値にする。空欄なら指定なし(undefined)
export function parseMaxPriceInput(input: string): { value: number | undefined } | { error: string } {
  if (!input.trim()) return { value: undefined }
  const value = Number(input)
  if (!isValidMaxPrice(value)) {
    return { error: `上限金額は 0〜${WORKSHOP_PRICE_MAX.toLocaleString()} の整数で入力してください` }
  }
  return { value }
}

// 期間指定の開始日・終了日(YYYY-MM-DD、片方だけでもよい)を確かめ、問題があればメッセージを返す
export function validateDateRange(from: string, to: string): string | null {
  if (!from && !to) return '開始日か終了日の少なくとも一方を選択してください'
  if ((from && !DATE_INPUT_PATTERN.test(from)) || (to && !DATE_INPUT_PATTERN.test(to))) {
    return '日付の形式が正しくありません'
  }
  // YYYY-MM-DD 形式どうしなので、文字列の比較で日付の前後が分かる
  if (from && to && to < from) return '終了日は開始日以降の日付を選択してください'
  return null
}

// URL は手で書き換えられるので、不正な値は無視して既定値に戻す
export function readListState(params: URLSearchParams): WorkshopListState {
  const price = pick(params.get('price'), ['all', 'free', 'paid'] as const, 'all')
  const maxPriceRaw = Number(params.get('max_price'))
  const maxPrice =
    price === 'paid' && params.get('max_price') !== null && isValidMaxPrice(maxPriceRaw) ? maxPriceRaw : undefined

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
  if (state.price === 'paid' && state.maxPrice !== undefined) params.set('max_price', String(state.maxPrice))
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

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
}

// 端末の時間帯での日付の区切り(0時)を基準に、開催日時の範囲 [start_from, start_to) を返す。
// 「今日」などは一覧を表示した時点の日付で決まる。期間の終了日はその日の終わりまでを含む
function startRangeFor(state: WorkshopListState, now = new Date()): Pick<ListWorkshopsParams, 'start_from' | 'start_to'> {
  const today = addDays(now, 0)
  switch (state.date) {
    case 'all':
      return {}
    case 'today':
      return { start_from: today.toISOString(), start_to: addDays(today, 1).toISOString() }
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
    max_price: state.price === 'paid' ? state.maxPrice : undefined,
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

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // 保存できなくても一覧は使える(戻ったときに状態が復元されないだけ)
  }
}

export function saveLastListUrl(url: string) {
  writeSession(LAST_LIST_URL_KEY, url)
}

// 最後に表示していた一覧の URL。一覧を開いていなければトップ
export function getLastListUrl(): string {
  const url = readSession(LAST_LIST_URL_KEY)
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/'
}

function readScrollMap(): Record<string, number> {
  try {
    const data: unknown = JSON.parse(readSession(SCROLL_KEY) ?? '{}')
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
  writeSession(SCROLL_KEY, JSON.stringify(map))
}

export function getListScroll(url: string): number | null {
  const y = readScrollMap()[url]
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}
