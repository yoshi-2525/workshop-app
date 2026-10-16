import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listFollowedFacilitators, listFollowedWorkshops } from '@/api/follows'
import type { WorkshopSort } from '@/api/workshops'
import { FollowButton } from '@/components/facilitator/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Pagination } from '@/components/ui/Pagination'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { WorkshopSortSelect } from '@/components/workshop/WorkshopSortSelect'
import { useApiResource } from '@/hooks/useApiResource'
import { useBackState } from '@/hooks/useBackState'
import { pageCount } from '@/utils/pagination'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

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
      <Breadcrumb />
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
  const { data, loading, error } = useApiResource(
    `following-facilitators:${page}`,
    (signal) => listFollowedFacilitators(page, FACILITATORS_PER_PAGE, signal),
    'フォロー中の主催者の取得に失敗しました',
  )
  const facilitators = data?.items ?? []
  const totalPages = pageCount(data?.total, FACILITATORS_PER_PAGE)
  // 他の画面で解除して件数が減り、今のページがなくなったら最後のページへ移る
  if (data && page > totalPages) setPage(totalPages)

  return (
    <section className="mt-6" aria-labelledby="following-facilitators-heading">
      <h2 id="following-facilitators-heading" className="sr-only">
        フォロー一覧
      </h2>
      {loading && !data && <LoadingMessage />}
      <ErrorMessage message={error} />
      {data && facilitators.length === 0 && (
        <p className="text-fg-muted">まだフォローしている主催者はいません。主催者のページからフォローできます。</p>
      )}
      {facilitators.length > 0 && (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p aria-hidden="true" className="text-base font-semibold text-fg-secondary">
              フォロー中の主催者
            </p>
            {data && <span className="text-sm text-fg-muted">{data.total}人</span>}
          </div>
          {/* 暗い面のカード1枚に、主催者を1行ずつ並べる(ワークショップ管理・予約状況の一覧と同じ面) */}
          <ul className="divide-y divide-border-muted overflow-hidden rounded-lg bg-surface-muted shadow-card">
            {facilitators.map((facilitator) => (
              // 行全体を主催者ページへのリンクにする(名前のリンクの当たり判定を after で広げる)。
              // フォローボタンは relative z-10 で、広げたリンクより手前に出す
              <li
                key={facilitator.id}
                className="relative flex items-center gap-4 p-4 transition-colors hover:bg-surface-strong/40 has-[a:focus-visible]:bg-surface-strong/40 sm:gap-5 sm:px-6 sm:py-5"
              >
                <Avatar url={facilitator.avatar_url} name={facilitator.name} className="h-12 w-12 text-lg" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/facilitators/${facilitator.id}`}
                    state={backState}
                    className="block truncate text-base font-medium text-fg after:absolute after:inset-0 focus-ring focus:outline-hidden"
                  >
                    {facilitator.name}
                  </Link>
                  {/* 自己紹介は2行までにして、行の高さをそろえる。未記入なら出さない */}
                  {facilitator.bio && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{facilitator.bio}</p>}
                </div>
                {/* 解除してもすぐには一覧から消さず、ボタンが「フォローする」に戻るだけにする(押し間違えてもその場で戻せるように)。
                    一覧から消えるのは、ページやセグメントを切り替えて取り直したとき */}
                <FollowButton
                  facilitator={facilitator}
                  isFollowing={facilitator.viewer?.is_following ?? true}
                  surface="dark"
                  className="z-10 shrink-0"
                />
                {/* MaterialIcon は自前で表示形式を指定しているので、狭い画面で隠すのは外側の span で行う */}
                <span className="hidden shrink-0 sm:flex">
                  <MaterialIcon name="chevron_right" className="text-[24px] text-fg-subtle" />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
    </section>
  )
}
