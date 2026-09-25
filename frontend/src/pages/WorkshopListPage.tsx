import { useEffect, useId, useState, type SubmitEvent } from 'react'
import axios from 'axios'
import { listWorkshops } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { WorkshopCard } from '../components/WorkshopCard'
import type { LocationType, Workshop } from '../types'

type LocationTypeFilter = 'all' | LocationType
type PriceFilter = 'all' | 'free' | 'paid'
type SearchParams = NonNullable<Parameters<typeof listWorkshops>[0]>

// バックエンドの制約(routers/workshops.py の q, schemas/workshop.py の price)に合わせる
const KEYWORD_MAX_LENGTH = 100
const MAX_PRICE_LIMIT = 10_000_000

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1'

type ToggleOption<T extends string> = { value: T; label: string }

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ToggleOption<T>[]
  value: T
  onChange: (next: T) => void
}) {
  const labelId = useId()
  return (
    <div>
      <span id={labelId} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded px-3 py-1.5 font-medium transition focus:outline-none ${FOCUS_RING} ${
              value === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const LOCATION_TYPE_OPTIONS: ToggleOption<LocationTypeFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'offline', label: 'オフライン(会場)' },
  { value: 'online', label: 'オンライン' },
]

const PRICE_OPTIONS: ToggleOption<PriceFilter>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'free', label: '無料' },
  { value: 'paid', label: '有料' },
]

export function WorkshopListPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keywordQuery, setKeywordQuery] = useState('')
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationTypeFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [maxPriceError, setMaxPriceError] = useState<string | null>(null)
  // 検索ボタンで確定した条件。これが変わったときだけ API を呼ぶ
  const [searchParams, setSearchParams] = useState<SearchParams>({})

  const keywordId = useId()
  const maxPriceId = useId()
  const maxPriceErrorId = useId()

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    listWorkshops(searchParams, controller.signal)
      .then((data) => {
        setWorkshops(data)
        setLoading(false)
      })
      .catch((err) => {
        // 次の検索で中断された古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
        setLoading(false)
      })

    return () => controller.abort()
  }, [searchParams])

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

    setSearchParams({
      q: keyword || undefined,
      location_type: locationTypeFilter === 'all' ? undefined : locationTypeFilter,
      price: priceFilter === 'all' ? undefined : priceFilter,
      max_price: maxPriceValue,
    })
  }

  function setPriceFilterOption(next: PriceFilter) {
    setPriceFilter(next)
    if (next !== 'paid') {
      setMaxPrice('')
      setMaxPriceError(null)
    }
  }

  const hasActiveFilter = Boolean(searchParams.q || searchParams.location_type || searchParams.price)

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">開催予定のワークショップ</h1>

      {/* 上限金額の検証は handleSearch で行い、エラーを画面に表示する */}
      <form
        noValidate
        onSubmit={handleSearch}
        className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
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
            className={`mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none ${FOCUS_RING}`}
          />
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
                  maxPriceError ? 'border-red-500' : 'border-slate-300 focus:border-slate-500'
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
            className={`ml-auto rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none disabled:opacity-50 ${FOCUS_RING}`}
          >
            検索
          </button>
        </div>
      </form>

      {/* 検索結果の更新をスクリーンリーダーに通知する */}
      <div aria-live="polite">
        {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
        {!loading && !error && workshops.length === 0 && (
          <p className="mt-6 text-slate-500">
            {hasActiveFilter
              ? '条件に一致するワークショップはありません。'
              : '現在公開中のワークショップはありません。'}
          </p>
        )}
        {!loading && !error && workshops.length > 0 && (
          <p className="sr-only">{workshops.length}件のワークショップが見つかりました。</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
    </div>
  )
}
