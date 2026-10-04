import { listMyFavorites } from '@/api/favorites'
import { WorkshopCard } from '@/components/workshop/WorkshopCard'
import { useApiResource } from '@/hooks/useApiResource'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'

export function FavoritesPage() {
  const { data, loading, error } = useApiResource('favorites', listMyFavorites, 'お気に入りの取得に失敗しました')
  const workshops = data ?? []

  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">お気に入り</h1>
      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {!loading && !error && workshops.length === 0 && (
        <p className="mt-6 text-fg-muted">まだお気に入りはありません。少しでも引っかかった場があれば、ハートで残しておけます。</p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
    </div>
  )
}
