import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listFollowedFacilitators, listFollowedWorkshops } from '@/api/follows'
import type { WorkshopSort } from '@/api/workshops'
import { FollowButton } from '@/components/facilitator/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { Pagination } from '@/components/ui/Pagination'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { WorkshopSortSelect } from '@/components/workshop/WorkshopSortSelect'
import { useApiResource } from '@/hooks/useApiResource'
import { useBackState } from '@/hooks/useBackState'

const PAGE_TITLE = 'フォロー中の主催者のワークショップ'
const WORKSHOPS_PER_PAGE = 10
const FACILITATORS_PER_PAGE = 20

type Segment = 'workshops' | 'facilitators'

const SEGMENT_OPTIONS: ToggleOption<Segment>[] = [
  { value: 'workshops', label: '開催予定のワークショップ' },
  { value: 'facilitators', label: 'フォロー一覧' },
]

// 表示中のセグメントと並び順は URL のクエリ(?tab=facilitators / ?sort=price)に持たせる。
// 主催者やワークショップのページから戻ったときに、同じ表示で開き直せるようにするため
const SEGMENT_PARAM = 'tab'
const SORT_PARAM = 'sort'
const SORTS: WorkshopSort[] = ['start', 'newest', 'price']

function parseSegment(value: string | null): Segment {
  return value === 'facilitators' ? 'facilitators' : 'workshops'
}

function parseSort(value: string | null): WorkshopSort {
  return SORTS.find((sort) => sort === value) ?? 'start'
}

function pageCount(total: number | undefined, perPage: number): number {
  return Math.max(1, Math.ceil((total ?? 0) / perPage))
}

export function FollowingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const segment = parseSegment(searchParams.get(SEGMENT_PARAM))
  const sort = parseSort(searchParams.get(SORT_PARAM))

  // 切り替えは履歴に積まない(戻るボタンで前のページへ戻れるように)。既定値はクエリに書かない
  function updateParams(next: { segment: Segment; sort: WorkshopSort }) {
    const params: Record<string, string> = {}
    if (next.segment !== 'workshops') params[SEGMENT_PARAM] = next.segment
    if (next.sort !== 'start') params[SORT_PARAM] = next.sort
    setSearchParams(params, { replace: true })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">{PAGE_TITLE}</h1>
      <ToggleGroup
        label="表示する内容"
        hideLabel
        options={SEGMENT_OPTIONS}
        value={segment}
        onChange={(next) => updateParams({ segment: next, sort })}
        className="mt-4"
      />
      {segment === 'workshops' ? (
        <FollowedWorkshops sort={sort} onSortChange={(next) => updateParams({ segment, sort: next })} />
      ) : (
        <FollowedFacilitators />
      )}
    </div>
  )
}

function FollowedWorkshops({
  sort,
  onSortChange,
}: {
  sort: WorkshopSort
  onSortChange: (next: WorkshopSort) => void
}) {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useApiResource(
    `following-workshops:${sort}:${page}`,
    (signal) => listFollowedWorkshops(sort, page, WORKSHOPS_PER_PAGE, signal),
    'ワークショップの取得に失敗しました',
  )
  const workshops = data?.items ?? []
  const totalPages = pageCount(data?.total, WORKSHOPS_PER_PAGE)
  // 件数が減って今のページがなくなったら、最後のページへ移る
  if (data && page > totalPages) setPage(totalPages)

  // 並び順を変えたら1ページ目から見せる
  function changeSort(next: WorkshopSort) {
    setPage(1)
    onSortChange(next)
  }

  return (
    <section className="mt-6" aria-label="開催予定のワークショップ">
      <div className="mb-4 flex justify-end">
        <WorkshopSortSelect value={sort} onChange={changeSort} />
      </div>
      {loading && !data && <LoadingMessage />}
      <ErrorMessage message={error} />
      {data && workshops.length === 0 && (
        <p className="text-fg-muted">フォロー中の主催者の、開催予定のワークショップはまだありません。</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} backLabel={PAGE_TITLE} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
    </section>
  )
}

function FollowedFacilitators() {
  const backState = useBackState(PAGE_TITLE)
  const [page, setPage] = useState(1)
  // フォローを解除した結果を読み上げる文と、解除後にフォーカスを移す先
  const [announcement, setAnnouncement] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { data, loading, error, reload } = useApiResource(
    `following-facilitators:${page}`,
    (signal) => listFollowedFacilitators(page, FACILITATORS_PER_PAGE, signal),
    'フォロー中の主催者の取得に失敗しました',
  )
  const facilitators = data?.items ?? []
  const totalPages = pageCount(data?.total, FACILITATORS_PER_PAGE)
  // 解除で件数が減り、今のページがなくなったら最後のページへ移る
  if (data && page > totalPages) setPage(totalPages)

  // 解除した主催者は一覧から消え、押したボタンもなくなるので、見出しへフォーカスを移して結果を伝える
  function handleFollowChange(name: string, isFollowing: boolean) {
    if (isFollowing) return
    setAnnouncement(`${name}さんのフォローを解除しました。`)
    headingRef.current?.focus()
    reload()
  }

  return (
    <section className="mt-6" aria-labelledby="following-facilitators-heading">
      <h2 id="following-facilitators-heading" ref={headingRef} tabIndex={-1} className="sr-only">
        フォロー一覧
      </h2>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {loading && !data && <LoadingMessage />}
      <ErrorMessage message={error} />
      {data && facilitators.length === 0 && (
        <p className="text-fg-muted">まだフォローしている主催者はいません。主催者のページからフォローできます。</p>
      )}
      {facilitators.length > 0 && (
        <ul className="space-y-3">
          {facilitators.map((facilitator) => (
            // カード全体を主催者ページへのリンクにする(名前のリンクの当たり判定を after で広げる)。
            // フォローボタンは relative z-10 で、広げたリンクより手前に出す
            <PaperCard
              key={facilitator.id}
              as="li"
              cornerFold={false}
              interactive
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar url={facilitator.avatar_url} name={facilitator.name} />
                <Link
                  to={`/facilitators/${facilitator.id}`}
                  state={backState}
                  className="truncate text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-lg focus:outline-none"
                >
                  {facilitator.name}
                </Link>
              </div>
              <FollowButton
                facilitator={facilitator}
                isFollowing={facilitator.viewer?.is_following ?? true}
                onChange={(isFollowing) => handleFollowChange(facilitator.name, isFollowing)}
                className="z-10"
              />
            </PaperCard>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
    </section>
  )
}
