import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getFacilitatorProfile } from '../api/users'
import { listWorkshops } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { WorkshopCard } from '../components/WorkshopCard'
import type { FacilitatorProfile, Workshop } from '../types'

export function FacilitatorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<FacilitatorProfile | null>(null)
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const facilitatorId = Number(id)
    Promise.all([getFacilitatorProfile(facilitatorId), listWorkshops({ facilitator_id: facilitatorId })])
      .then(([p, w]) => {
        setProfile(p)
        setWorkshops(w)
      })
      .catch((err) => setError(extractErrorMessage(err, '主催者情報の取得に失敗しました')))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!profile) return null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">{profile.name}</h1>
        <p className="mt-1 text-xs font-medium text-slate-400">
          {profile.role === 'admin' ? '運営' : '主催者'}
        </p>
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-slate-400">自己紹介はまだ登録されていません。</p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">開催中のワークショップ</h2>
      {workshops.length === 0 ? (
        <p className="mt-4 text-slate-500">現在公開中のワークショップはありません。</p>
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
