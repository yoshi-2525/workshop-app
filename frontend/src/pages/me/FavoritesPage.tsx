import { useEffect, useState } from 'react'
import axios from 'axios'
import { listMyFavorites } from '@/api/favorites'
import { extractErrorMessage } from '@/api/client'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import type { Workshop } from '@/types'

export function FavoritesPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listMyFavorites(controller.signal)
      .then(setWorkshops)
      .catch((err) => {
        // ページを離れて中断したリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'お気に入りの取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">お気に入り</h1>
      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && workshops.length === 0 && (
        <p className="mt-6 text-slate-500">お気に入り登録したワークショップはまだありません。</p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
    </div>
  )
}
