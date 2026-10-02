import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { getFacilitatorProfile } from '@/api/users'
import { listWorkshops } from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import type { FacilitatorProfile, Workshop } from '@/types'
import { parseIdParam } from '@/utils/params'

export function FacilitatorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<FacilitatorProfile | null>(null)
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const facilitatorId = parseIdParam(id)
    if (facilitatorId === null) {
      setError('主催者が見つかりませんでした')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([
      getFacilitatorProfile(facilitatorId, controller.signal),
      listWorkshops({ facilitator_id: facilitatorId }, controller.signal),
    ])
      .then(([p, w]) => {
        setProfile(p)
        setWorkshops(w)
      })
      .catch((err) => {
        // 別の主催者へ遷移して中断した古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, '主催者情報の取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    )
  if (!profile) return null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-border-muted bg-white p-6">
        <div className="flex items-center gap-4">
          <Avatar url={profile.avatar_url} name={profile.name} className="h-16 w-16 text-2xl" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{profile.name}</h1>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {profile.role === 'admin' ? '運営' : '主催者'}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-slate-400">自己紹介はまだ登録されていません。</p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">開催予定のワークショップ</h2>
      {workshops.length === 0 ? (
        <p className="mt-4 text-slate-500">開催予定のワークショップはありません。</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </div>
  )
}
