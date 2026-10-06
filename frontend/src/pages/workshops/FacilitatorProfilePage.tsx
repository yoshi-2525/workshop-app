import { useParams } from 'react-router-dom'
import { getFacilitatorProfile } from '@/api/users'
import { listWorkshops } from '@/api/workshops'
import { FollowButton } from '@/components/facilitator/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { useApiResource } from '@/hooks/useApiResource'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PaperCard } from '@/components/ui/PaperCard'

export function FacilitatorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const facilitatorId = parseIdParam(id)
  const { data, loading, error } = useApiResource(
    facilitatorId === null ? null : `facilitator:${facilitatorId}`,
    (signal) =>
      Promise.all([
        getFacilitatorProfile(facilitatorId!, signal),
        listWorkshops({ facilitator_id: facilitatorId! }, signal),
      ]),
    '主催者情報の取得に失敗しました',
  )

  if (loading) return <LoadingMessage />
  if (facilitatorId === null || error)
    return (
      <ErrorMessage message={error ?? '主催者が見つかりませんでした'} />
    )
  if (!data) return null
  const [profile, workshops] = data

  return (
    <div className="mx-auto max-w-3xl">
      <PaperCard cornerFold={false} className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar url={profile.avatar_url} name={profile.name} className="h-16 w-16 text-2xl" />
            <div>
              <h1 className="text-xl font-semibold text-fg">{profile.name}</h1>
              <p className="mt-1 text-xs font-medium text-fg-subtle">
                {profile.role === 'admin' ? '運営' : '主催者'}
              </p>
            </div>
          </div>
          <FollowButton facilitator={profile} isFollowing={profile.viewer?.is_following ?? false} />
        </div>
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-fg-secondary">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-fg-subtle">自己紹介はまだ登録されていません。</p>
        )}
      </PaperCard>

      <h2 className="mt-8 text-lg font-semibold text-fg">開催予定のワークショップ</h2>
      {workshops.length === 0 ? (
        <p className="mt-4 text-fg-muted">開催予定のワークショップはありません。</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} backLabel={`${profile.name}さんのワークショップ一覧ページ`} />
          ))}
        </div>
      )}
    </div>
  )
}
