import { useEffect, useId, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { listWorkshopsPage, type WorkshopSort } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { DatePicker } from '../components/DatePicker'
import { Pagination } from '../components/Pagination'
import { ToggleGroup, type ToggleOption } from '../components/ToggleGroup'
import { WorkshopCard } from '../components/WorkshopCard'
import { WORKSHOP_PRICE_MAX } from '../utils/workshop'
import {
  getListScroll,
  KEYWORD_MAX_LENGTH,
  readListState,
  saveLastListUrl,
  saveListScroll,
  toApiParams,
  toSearchParams,
  type DateFilter,
  type LocationTypeFilter,
  type PriceFilter,
  type WorkshopListState,
} from '../utils/workshopListState'
import type { Workshop } from '../types'

// 参加費はこれより高く設定できないので、上限金額もこの範囲で受け付ける
const MAX_PRICE_LIMIT = WORKSHOP_PRICE_MAX
const PER_PAGE = 30

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'

const LOCATION_TYPE_OPTIONS: ToggleOption<LocationTypeFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'offline', label: 'オフライン(会場)' },
  { value: 'online', label: 'オンライン' },
]

const SORT_OPTIONS: { value: WorkshopSort; label: string }[] = [
  { value: 'start', label: '開催日時の近い順' },
  { value: 'newest', label: '公開日時の新しい順' },
  { value: 'price', label: '価格の安い順' },
]

const DATE_OPTIONS: ToggleOption<DateFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'today', label: '今日' },
  { value: 'tomorrow', label: '明日' },
  { value: 'week', label: '直近1週間' },
  { value: 'range', label: '期間を指定' },
]

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validateRange(from: string, to: string): string | null {
  if (!from && !to) return '開始日か終了日の少なくとも一方を選択してください'
  if ((from && !DATE_INPUT_PATTERN.test(from)) || (to && !DATE_INPUT_PATTERN.test(to))) {
    return '日付の形式が正しくありません'
  }
  // YYYY-MM-DD 形式どうしなので、文字列の比較で日付の前後が分かる
  if (from && to && to < from) return '終了日は開始日以降の日付を選択してください'
  return null
}

const PRICE_OPTIONS: ToggleOption<PriceFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'free', label: '無料' },
  { value: 'paid', label: '有料' },
]

export function WorkshopListPage() {
  const [urlParams, setUrlParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const search = urlParams.toString()
  // 確定した検索条件・参加可能フィルター・並び替え・ページ番号(URL が正)
  const listState = useMemo(() => readListState(new URLSearchParams(search)), [search])
  const { page, available: onlyAvailable, sort } = listState

  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 入力中の値。検索ボタンを押すまで URL には反映しない
  const [keywordQuery, setKeywordQuery] = useState(listState.q)
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationTypeFilter>(listState.locationType)
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(listState.price)
  const [maxPrice, setMaxPrice] = useState(listState.maxPrice?.toString() ?? '')
  const [maxPriceError, setMaxPriceError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>(listState.date)
  const [rangeFrom, setRangeFrom] = useState(listState.from)
  const [rangeTo, setRangeTo] = useState(listState.to)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // ブラウザの「戻る」やナビバーのリンクで URL が変わったら、入力欄も URL の条件に合わせる
  const [syncedSearch, setSyncedSearch] = useState(search)
  if (search !== syncedSearch) {
    setSyncedSearch(search)
    setKeywordQuery(listState.q)
    setLocationTypeFilter(listState.locationType)
    setPriceFilter(listState.price)
    setMaxPrice(listState.maxPrice?.toString() ?? '')
    setMaxPriceError(null)
    setDateFilter(listState.date)
    setRangeFrom(listState.from)
    setRangeTo(listState.to)
    setRangeError(null)
  }

  const keywordId = useId()
  const maxPriceId = useId()
  const maxPriceErrorId = useId()
  const rangeErrorId = useId()
  const onlyAvailableId = useId()
  const sortId = useId()
  const resultsRef = useRef<HTMLDivElement>(null)

  const listUrl = `${location.pathname}${search ? `?${search}` : ''}`

  function updateList(changes: Partial<WorkshopListState>, options?: { replace?: boolean }) {
    setUrlParams(toSearchParams({ ...listState, ...changes }), options)
  }

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    listWorkshopsPage({ ...toApiParams(listState), page, perPage: PER_PAGE }, controller.signal)
      .then(({ items, total }) => {
        // 閲覧中に件数が減って現在ページが範囲外になった場合は最終ページへ
        const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))
        if (page > lastPage) {
          setUrlParams(toSearchParams({ ...listState, page: lastPage }), { replace: true })
          return
        }
        setWorkshops(items)
        setTotal(total)
        setLoading(false)
      })
      .catch((err) => {
        // 次の検索で中断された古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
        setLoading(false)
      })

    return () => controller.abort()
  }, [listState, page, setUrlParams])

  // 詳細ページの「一覧に戻る」の戻り先として、今の一覧の URL を覚えておく
  useEffect(() => {
    saveLastListUrl(listUrl)
  }, [listUrl])

  // 「一覧に戻る」やブラウザの「戻る」で表示したときは、一覧を読み込み終えてから保存した位置へ戻す
  const shouldRestoreScroll =
    navigationType === 'POP' ||
    Boolean((location.state as { restoreScroll?: boolean } | null)?.restoreScroll)
  // 復元(または復元不要の判断)を済ませた表示の location.key。済むまではスクロール位置を保存しない
  // (読み込み中は一覧が短く、ブラウザがスクロール位置を 0 に戻すので、それで保存済みの位置を上書きしないため)
  const settledKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || settledKeyRef.current === location.key) return
    settledKeyRef.current = location.key
    const y = shouldRestoreScroll ? getListScroll(listUrl) : null
    if (y !== null) window.scrollTo(0, y)
    else saveListScroll(listUrl, window.scrollY)
  }, [loading, shouldRestoreScroll, location.key, listUrl])

  // スクロール位置を一覧の URL ごとに保存する(スクロールのたびに書き込まないよう、描画のタイミングにまとめる)
  useEffect(() => {
    let frame = 0
    function handleScroll() {
      if (settledKeyRef.current !== location.key) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => saveListScroll(listUrl, window.scrollY))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [listUrl, location.key])

  function handleSearch(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    // 貼り付けなどで maxLength を超えた場合の保険
    const keyword = keywordQuery.trim().slice(0, KEYWORD_MAX_LENGTH)

    let maxPriceValue: number | undefined
    if (priceFilter === 'paid' && maxPrice.trim()) {
      const n = Number(maxPrice)
      if (!Number.isInteger(n) || n < 0 || n > MAX_PRICE_LIMIT) {
        setMaxPriceError(
          `上限金額は 0〜${MAX_PRICE_LIMIT.toLocaleString()} の整数で入力してください`,
        )
        return
      }
      maxPriceValue = n
    }
    setMaxPriceError(null)

    if (dateFilter === 'range') {
      const message = validateRange(rangeFrom, rangeTo)
      if (message) {
        setRangeError(message)
        return
      }
    }
    setRangeError(null)

    updateList({
      q: keyword,
      locationType: locationTypeFilter,
      price: priceFilter,
      maxPrice: maxPriceValue,
      date: dateFilter,
      from: dateFilter === 'range' ? rangeFrom : '',
      to: dateFilter === 'range' ? rangeTo : '',
      page: 1,
    })
  }

  function setDateFilterOption(next: DateFilter) {
    setDateFilter(next)
    if (next !== 'range') {
      setRangeFrom('')
      setRangeTo('')
      setRangeError(null)
    }
  }

  function setPriceFilterOption(next: PriceFilter) {
    setPriceFilter(next)
    if (next !== 'paid') {
      setMaxPrice('')
      setMaxPriceError(null)
    }
  }

  function toggleOnlyAvailable(next: boolean) {
    updateList({ available: next, page: 1 })
  }

  function changeSort(next: WorkshopSort) {
    updateList({ sort: next, page: 1 })
  }

  function changePage(next: number) {
    updateList({ page: next })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const hasActiveFilter = Boolean(
    listState.q ||
      listState.locationType !== 'all' ||
      listState.price !== 'all' ||
      listState.date !== 'all' ||
      onlyAvailable,
  )

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">開催予定のワークショップ</h1>

      {/* 上限金額・開催日の検証は handleSearch で行い、エラーを画面に表示する */}
      <form
        noValidate
        onSubmit={handleSearch}
        className="mt-4 space-y-4 rounded-lg border border-border-muted bg-white p-4"
      >
        <div>
          <label htmlFor={keywordId} className="block text-sm font-medium text-slate-700">
            キーワードで検索
          </label>
          <input
            id={keywordId}
            type="search"
            maxLength={KEYWORD_MAX_LENGTH}
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder="例: 哲学、対話 など(タイトル・詳細から検索)"
            className={`mt-1 w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none ${FOCUS_RING}`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <ToggleGroup
            label="開催日"
            options={DATE_OPTIONS}
            value={dateFilter}
            onChange={setDateFilterOption}
          />

          {dateFilter === 'range' && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  label="検索開始日"
                  placeholder="開始日"
                  value={rangeFrom}
                  onChange={setRangeFrom}
                  maxDate={rangeTo || undefined}
                  disablePast
                  clearable
                  invalid={Boolean(rangeError)}
                  describedBy={rangeError ? rangeErrorId : undefined}
                  size="sm"
                  className="w-44"
                />
                <span aria-hidden="true" className="text-sm text-slate-500">
                  〜
                </span>
                <DatePicker
                  label="検索終了日"
                  placeholder="終了日"
                  value={rangeTo}
                  onChange={setRangeTo}
                  minDate={rangeFrom || undefined}
                  disablePast
                  clearable
                  invalid={Boolean(rangeError)}
                  describedBy={rangeError ? rangeErrorId : undefined}
                  size="sm"
                  className="w-44"
                />
              </div>
              {rangeError && (
                <p id={rangeErrorId} role="alert" className="mt-1 text-xs text-red-600">
                  {rangeError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <ToggleGroup
            label="開催形式"
            options={LOCATION_TYPE_OPTIONS}
            value={locationTypeFilter}
            onChange={setLocationTypeFilter}
          />

          <ToggleGroup
            label="料金"
            options={PRICE_OPTIONS}
            value={priceFilter}
            onChange={setPriceFilterOption}
          />

          {priceFilter === 'paid' && (
            <div>
              <label htmlFor={maxPriceId} className="mb-1 block text-sm font-medium text-slate-700">
                上限金額(円)
              </label>
              <input
                id={maxPriceId}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PRICE_LIMIT}
                step={1}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="指定なし"
                aria-invalid={maxPriceError ? true : undefined}
                aria-describedby={maxPriceError ? maxPriceErrorId : undefined}
                className={`w-32 rounded-md border px-3 py-2 text-sm focus:outline-none ${FOCUS_RING} ${
                  maxPriceError ? 'border-red-500' : 'border-border focus:border-ring'
                }`}
              />
              {maxPriceError && (
                <p id={maxPriceErrorId} role="alert" className="mt-1 text-xs text-red-600">
                  {maxPriceError}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`ml-auto rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover focus:outline-none disabled:opacity-50 ${FOCUS_RING}`}
          >
            検索
          </button>
        </div>
      </form>

      {/* 検索ボタンを待たず、変更した時点で反映する表示条件 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <input
            id={onlyAvailableId}
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => toggleOnlyAvailable(e.target.checked)}
            className={`h-4 w-4 rounded border-border accent-accent focus:outline-none ${FOCUS_RING}`}
          />
          <label htmlFor={onlyAvailableId} className="text-sm font-medium text-slate-700">
            参加可能なワークショップを表示する
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm font-medium text-slate-700">
            並び替え
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => changeSort(e.target.value as WorkshopSort)}
            className={`rounded-md border border-border px-3 py-1.5 text-sm focus:border-ring focus:outline-none ${FOCUS_RING}`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* 検索結果の更新をスクリーンリーダーに通知する */}
      <div ref={resultsRef} aria-live="polite" className="scroll-mt-4">
        {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
        {!loading && !error && workshops.length === 0 && (
          <p className="mt-6 text-slate-500">
            {hasActiveFilter
              ? '条件に一致するワークショップはありません。'
              : '開催予定のワークショップはありません。'}
          </p>
        )}
        {!loading && !error && workshops.length > 0 && (
          <p className="mt-6 text-sm text-slate-600">
            全{total}件中 {(page - 1) * PER_PAGE + 1}〜{(page - 1) * PER_PAGE + workshops.length}件を表示
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={changePage} disabled={loading} />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={changePage} disabled={loading} />
    </div>
  )
}
