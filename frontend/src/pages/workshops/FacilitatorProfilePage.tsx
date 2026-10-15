import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { getFacilitatorProfile } from '@/api/users'
import { listWorkshops, type WorkshopSort } from '@/api/workshops'
import { FollowButton } from '@/components/facilitator/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { BackLink } from '@/components/ui/BackLink'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { WorkshopSortSelect } from '@/components/workshop/WorkshopSortSelect'
import { useApiResource } from '@/hooks/useApiResource'
import { readBackTarget } from '@/hooks/useBackState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'

// 並び順は URL のクエリ(?sort=price)に持たせる。ワークショップの詳細から戻ったときに、同じ並びで開き直せるようにするため
const SORT_PARAM = 'sort'
const SORTS: WorkshopSort[] = ['start', 'newest', 'price']

function parseSort(value: string | null): WorkshopSort {
  return SORTS.find((sort) => sort === value) ?? 'start'
}

export function FacilitatorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  // 戻るリンクは、リンク元(ワークショップ詳細・フォロー一覧など)が戻り先を渡したときだけ出す。
  // 直接開いたときは、戻る先が決まらないので出さない
  const backTarget = readBackTarget(location.state)
  const facilitatorId = parseIdParam(id)
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = parseSort(searchParams.get(SORT_PARAM))
  const { data: profile, loading, error } = useApiResource(
    facilitatorId === null ? null : `facilitator:${facilitatorId}`,
    (signal) => getFacilitatorProfile(facilitatorId!, signal),
    '主催者情報の取得に失敗しました',
  )
  // 並び替えのたびにプロフィールまで取り直さないよう、ワークショップの一覧は別に取得する
  const {
    data: workshopsData,
    loading: workshopsLoading,
    error: workshopsError,
  } = useApiResource(
    facilitatorId === null ? null : `facilitator-workshops:${facilitatorId}:${sort}`,
    (signal) => listWorkshops({ facilitator_id: facilitatorId!, sort }, signal),
    'ワークショップの取得に失敗しました',
  )
  usePageTitle(profile ? `${profile.name}さんのプロフィール` : null)

  // 切り替えは履歴に積まない(戻るボタンで前のページへ戻れるように)。既定値はクエリに書かない
  function changeSort(next: WorkshopSort) {
    setSearchParams(next === 'start' ? {} : { [SORT_PARAM]: next }, { replace: true })
  }

  if (loading) return <LoadingMessage />
  if (facilitatorId === null || error)
    return (
      <ErrorMessage message={error ?? '主催者が見つかりませんでした'} />
    )
  if (!profile) return null
  const workshops = workshopsData ?? []

  return (
    <div className="mx-auto max-w-3xl">
      {backTarget && <BackLink to={backTarget.to}>{backTarget.label}に戻る</BackLink>}

      {/* プロフィールはページの見出しにあたるので、紙のカードに載せず夜の地にそのまま置く */}
      <section
        aria-labelledby="facilitator-name"
        className="flex flex-wrap items-start gap-x-8 gap-y-6 border-b border-border-muted pb-10 sm:mt-3"
      >
        <Avatar
          url={profile.avatar_url}
          name={profile.name}
          className="h-20 w-20 border border-border-muted text-3xl sm:h-28 sm:w-28 sm:text-4xl"
        />
        <div className="min-w-0 flex-[1_1_20rem]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm tracking-wider text-fg-muted">{profile.role === 'admin' ? '運営' : '主催者'}</p>
              <h1 id="facilitator-name" className="mt-1 break-words text-2xl font-semibold tracking-wide text-fg sm:text-3xl">
                {profile.name}
              </h1>
            </div>
            <FollowButton facilitator={profile} isFollowing={profile.viewer?.is_following ?? false} />
          </div>
          {profile.bio ? (
            <p className="mt-4 max-w-[40em] whitespace-pre-wrap leading-loose text-fg-secondary">{profile.bio}</p>
          ) : (
            <p className="mt-4 text-sm text-fg-muted">自己紹介はまだ登録されていません。</p>
          )}
        </div>
      </section>

      <section aria-labelledby="facilitator-workshops" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="facilitator-workshops" className="text-lg font-semibold text-fg">
            開催予定のワークショップ
          </h2>
          {/* 並べ替える意味があるのは2件以上のときだけ */}
          {workshops.length > 1 && (
            <WorkshopSortSelect value={sort} onChange={changeSort} disabled={workshopsLoading} />
          )}
        </div>
        {workshopsLoading && !workshopsData && <LoadingMessage className="mt-4" />}
        <ErrorMessage message={workshopsError} className="mt-4" />
        {!workshopsData ? null : workshops.length === 0 ? (
          <p className="mt-4 text-fg-muted">開催予定のワークショップはありません。</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} backLabel={`${profile.name}さんのワークショップ一覧ページ`} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
