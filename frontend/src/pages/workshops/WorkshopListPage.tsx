import { useEffect, useId, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { WorkshopSort } from '@/api/workshops'
import { Pagination } from '@/components/ui/Pagination'
import type { ToggleOption } from '@/components/ui/ToggleGroup'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { WorkshopSearchForm, type WorkshopSearchConditions } from '@/components/workshop/WorkshopSearchForm'
import { useListScrollRestoration } from '@/hooks/useListScrollRestoration'
import { useWorkshopListPage } from '@/hooks/useWorkshopListPage'
import { HomeHero } from '@/components/home/HomeHero'
import {
  readListState,
  saveLastListUrl,
  toSearchParams,
  type WorkshopListState,
} from '@/utils/workshopListState'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'

const PER_PAGE = 30

const SORT_OPTIONS: ToggleOption<WorkshopSort>[] = [
  { value: 'start', label: '開催日時の近い順' },
  { value: 'newest', label: '公開日時の新しい順' },
  { value: 'price', label: '参加費の安い順' },
]

export function WorkshopListPage() {
  const [urlParams, setUrlParams] = useSearchParams()
  const location = useLocation()
  const search = urlParams.toString()
  // 確定した検索条件・参加可能フィルター・並び替え・ページ番号(URL が正)
  const listState = useMemo(() => readListState(new URLSearchParams(search)), [search])
  const { page, available: onlyAvailable, sort } = listState
  const listUrl = `${location.pathname}${search ? `?${search}` : ''}`

  function updateList(changes: Partial<WorkshopListState>, options?: { replace?: boolean }) {
    setUrlParams(toSearchParams({ ...listState, ...changes }), options)
  }

  const { workshops, total, loading, error } = useWorkshopListPage(listState, {
    perPage: PER_PAGE,
    // 閲覧中に件数が減って現在ページが範囲外になった場合は最終ページへ
    onPageOutOfRange: (lastPage) => updateList({ page: lastPage }, { replace: true }),
  })

  useListScrollRestoration(listUrl, loading)

  // 詳細ページの「一覧に戻る」の戻り先として、今の一覧の URL を覚えておく
  useEffect(() => {
    saveLastListUrl(listUrl)
  }, [listUrl])

  const onlyAvailableId = useId()
  const sortId = useId()
  const resultsRef = useRef<HTMLDivElement>(null)

  function handleSearch(conditions: WorkshopSearchConditions) {
    updateList({ ...conditions, page: 1 })
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
      <HomeHero />

      <h2 className="font-brand text-xl font-semibold tracking-wider text-fg">これから開かれる場</h2>
      <p className="mt-1 text-sm text-fg-muted">聞いているだけでもかまいません。気になったら、のぞいてみてください。</p>

      <WorkshopSearchForm listState={listState} disabled={loading} onSearch={handleSearch} />

      {/* 検索ボタンを待たず、変更した時点で反映する表示条件 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <input
            id={onlyAvailableId}
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => updateList({ available: e.target.checked, page: 1 })}
            className="h-4 w-4 rounded border-border accent-accent focus-ring focus:outline-none"
          />
          <label htmlFor={onlyAvailableId} className="text-sm font-medium text-fg-secondary">
            参加可能なワークショップを表示する
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm font-medium text-fg-secondary">
            並び替え
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => updateList({ sort: e.target.value as WorkshopSort, page: 1 })}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-ring focus:border-ring focus:outline-none"
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
        {loading && <LoadingMessage className="mt-6" />}
        {!loading && !error && workshops.length === 0 && (
          <p className="mt-6 text-fg-muted">
            {hasActiveFilter
              ? '条件に合う場は見つかりませんでした。条件を少しゆるめてみてください。'
              : 'いまは開かれる予定の場がありません。また、ふと思い出したときにのぞいてみてください。'}
          </p>
        )}
        {!loading && !error && workshops.length > 0 && (
          <p className="mt-6 text-sm text-fg-secondary">
            全{total}件中 {(page - 1) * PER_PAGE + 1}〜{(page - 1) * PER_PAGE + workshops.length}件を表示
          </p>
        )}
      </div>
      <ErrorMessage message={error} className="mt-6" />
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
