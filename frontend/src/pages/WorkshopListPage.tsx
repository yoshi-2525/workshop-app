import { useEffect, useMemo, useState } from 'react'
import { listWorkshops } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { WorkshopCard } from '../components/WorkshopCard'
import type { LocationType, Workshop } from '../types'

type LocationTypeFilter = 'all' | LocationType
type PriceFilter = 'all' | 'free' | 'paid'

export function WorkshopListPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keywordQuery, setKeywordQuery] = useState('')
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationTypeFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    listWorkshops()
      .then(setWorkshops)
      .catch((err) => setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました')))
      .finally(() => setLoading(false))
  }, [])

  function setPriceFilterOption(next: PriceFilter) {
    setPriceFilter(next)
    if (next !== 'paid') setMaxPrice('')
  }

  const filtered = useMemo(() => {
    const query = keywordQuery.trim().toLowerCase()
    const maxPriceValue = maxPrice.trim() ? Number(maxPrice) : null

    return workshops.filter((w) => {
      if (locationTypeFilter !== 'all' && w.location_type !== locationTypeFilter) return false
      if (
        query &&
        !w.title.toLowerCase().includes(query) &&
        !w.description.toLowerCase().includes(query)
      )
        return false
      if (priceFilter === 'free' && w.price !== 0) return false
      if (priceFilter === 'paid') {
        if (w.price === 0) return false
        if (maxPriceValue !== null && w.price > maxPriceValue) return false
      }
      return true
    })
  }, [workshops, keywordQuery, locationTypeFilter, priceFilter, maxPrice])

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">開催予定のワークショップ</h1>

      <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">キーワードで検索</label>
          <input
            type="text"
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder="例: 哲学、対話 など(タイトル・詳細から検索)"
            className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">開催形式</span>
            <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setLocationTypeFilter('all')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  locationTypeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setLocationTypeFilter('offline')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  locationTypeFilter === 'offline'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                オフライン(会場)
              </button>
              <button
                type="button"
                onClick={() => setLocationTypeFilter('online')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  locationTypeFilter === 'online'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                オンライン
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">料金</span>
            <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setPriceFilterOption('all')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  priceFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setPriceFilterOption('free')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  priceFilter === 'free' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                無料
              </button>
              <button
                type="button"
                onClick={() => setPriceFilterOption('paid')}
                className={`rounded px-3 py-1.5 font-medium transition ${
                  priceFilter === 'paid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                有料
              </button>
            </div>
          </div>

          {priceFilter === 'paid' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">上限金額(円)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="指定なし"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && <p className="mt-6 text-red-600">{error}</p>}
      {!loading && !error && workshops.length === 0 && (
        <p className="mt-6 text-slate-500">現在公開中のワークショップはありません。</p>
      )}
      {!loading && !error && workshops.length > 0 && filtered.length === 0 && (
        <p className="mt-6 text-slate-500">条件に一致するワークショップはありません。</p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filtered.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
    </div>
  )
}
