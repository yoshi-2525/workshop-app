import { useId, useState, type SubmitEvent } from 'react'
import { LOCATION_TYPE_OPTIONS, WORKSHOP_PRICE_MAX } from '@/utils/workshop'
import {
  KEYWORD_MAX_LENGTH,
  parseMaxPriceInput,
  validateDateRange,
  type DateFilter,
  type LocationTypeFilter,
  type PriceFilter,
  type WorkshopListState,
} from '@/utils/workshopListState'
import { DatePicker } from '@/components/ui/DatePicker'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

// 検索ボタンで確定する条件(参加可能・並び替え・ページは一覧の側で扱う)
export type WorkshopSearchConditions = Pick<
  WorkshopListState,
  'q' | 'locationType' | 'price' | 'maxPrice' | 'date' | 'from' | 'to'
>

const DATE_OPTIONS: ToggleOption<DateFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'tomorrow', label: '明日' },
  { value: 'week', label: '直近1週間' },
  { value: 'range', label: '期間を指定' },
]

const LOCATION_TYPE_FILTER_OPTIONS: ToggleOption<LocationTypeFilter>[] = [
  { value: 'all', label: 'すべて' },
  ...LOCATION_TYPE_OPTIONS,
]

const PRICE_OPTIONS: ToggleOption<PriceFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'free', label: '無料' },
  { value: 'paid', label: '有料' },
]

interface WorkshopSearchFormProps {
  // 確定済みの条件(URL から読んだもの)。入力欄の初期値にし、変わったら入力欄もそれに合わせる
  listState: WorkshopListState
  disabled?: boolean
  // 入力チェックを通ったときだけ呼ぶ
  onSearch: (conditions: WorkshopSearchConditions) => void
}

// ワークショップ一覧の検索フォーム。入力中の値はこの中だけで持ち、検索ボタンを押したときに確定する
export function WorkshopSearchForm({ listState, disabled = false, onSearch }: WorkshopSearchFormProps) {
  const [keywordQuery, setKeywordQuery] = useState(listState.q)
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationTypeFilter>(listState.locationType)
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(listState.price)
  const [maxPrice, setMaxPrice] = useState(listState.maxPrice?.toString() ?? '')
  const [maxPriceError, setMaxPriceError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>(listState.date)
  const [rangeFrom, setRangeFrom] = useState(listState.from)
  const [rangeTo, setRangeTo] = useState(listState.to)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // ブラウザの「戻る」やナビバーのリンクで URL(確定済みの条件)が変わったら、入力欄もそれに合わせる。
  // listState は URL が変わったときだけ作り直されるので、オブジェクトが変わったかで判定できる
  const [syncedState, setSyncedState] = useState(listState)
  if (listState !== syncedState) {
    setSyncedState(listState)
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

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()

    let maxPriceValue: number | undefined
    if (priceFilter === 'paid') {
      const parsed = parseMaxPriceInput(maxPrice)
      if ('error' in parsed) {
        setMaxPriceError(parsed.error)
        return
      }
      maxPriceValue = parsed.value
    }
    setMaxPriceError(null)

    if (dateFilter === 'range') {
      const message = validateDateRange(rangeFrom, rangeTo)
      if (message) {
        setRangeError(message)
        return
      }
    }
    setRangeError(null)

    onSearch({
      // 貼り付けなどで maxLength を超えた場合の保険
      q: keywordQuery.trim().slice(0, KEYWORD_MAX_LENGTH),
      locationType: locationTypeFilter,
      price: priceFilter,
      maxPrice: maxPriceValue,
      date: dateFilter,
      from: dateFilter === 'range' ? rangeFrom : '',
      to: dateFilter === 'range' ? rangeTo : '',
    })
  }

  function changeDateFilter(next: DateFilter) {
    setDateFilter(next)
    if (next !== 'range') {
      setRangeFrom('')
      setRangeTo('')
      setRangeError(null)
    }
  }

  function changePriceFilter(next: PriceFilter) {
    setPriceFilter(next)
    if (next !== 'paid') {
      setMaxPrice('')
      setMaxPriceError(null)
    }
  }

  return (
    // 上限金額・開催日の検証は handleSubmit で行い、エラーを画面に表示する
    <form
      noValidate
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-lg border border-border-muted bg-surface p-4"
    >
      <div>
        <label htmlFor={keywordId} className={LABEL_CLASS}>
          キーワードで検索
        </label>
        <input
          id={keywordId}
          type="search"
          maxLength={KEYWORD_MAX_LENGTH}
          value={keywordQuery}
          onChange={(e) => setKeywordQuery(e.target.value)}
          placeholder="例: 哲学、対話 など(タイトル・詳細から検索)"
          className={`${INPUT_CLASS} max-w-sm focus-ring`}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <ToggleGroup label="開催日" options={DATE_OPTIONS} value={dateFilter} onChange={changeDateFilter} />

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
              <span aria-hidden="true" className="text-sm text-fg-muted">
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
              <p id={rangeErrorId} role="alert" className="mt-1 text-xs text-red-300">
                {rangeError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <ToggleGroup
          label="開催形式"
          options={LOCATION_TYPE_FILTER_OPTIONS}
          value={locationTypeFilter}
          onChange={setLocationTypeFilter}
        />

        <ToggleGroup label="料金" options={PRICE_OPTIONS} value={priceFilter} onChange={changePriceFilter} />

        {priceFilter === 'paid' && (
          <div>
            <label htmlFor={maxPriceId} className="mb-1 block text-sm font-medium text-fg-secondary">
              上限金額(円)
            </label>
            <input
              id={maxPriceId}
              type="number"
              inputMode="numeric"
              min={0}
              max={WORKSHOP_PRICE_MAX}
              step={1}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="指定なし"
              aria-invalid={maxPriceError ? true : undefined}
              aria-describedby={maxPriceError ? maxPriceErrorId : undefined}
              className={`w-32 rounded-md border px-3 py-2 text-sm focus-ring focus:outline-none ${
                maxPriceError ? 'border-red-500' : 'border-border focus:border-ring'
              }`}
            />
            {maxPriceError && (
              <p id={maxPriceErrorId} role="alert" className="mt-1 text-xs text-red-300">
                {maxPriceError}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={disabled}
          className={`ml-auto ${PRIMARY_BUTTON_CLASS}`}
        >
          検索
        </button>
      </div>
    </form>
  )
}
