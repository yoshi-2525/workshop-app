import { Link } from 'react-router-dom'
import type { Workshop } from '../types'
import { formatPrice } from '../utils/format'
import { FavoriteButton } from './FavoriteButton'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function WorkshopCard({ workshop }: { workshop: Workshop }) {
  const isFull = workshop.reserved_count >= workshop.capacity

  return (
    <Link
      to={`/workshops/${workshop.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      {workshop.image_url && (
        <img
          src={workshop.image_url}
          alt=""
          className="mb-3 h-36 w-full rounded-md object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{workshop.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {workshop.is_reserved && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              予約済み
            </span>
          )}
          <FavoriteButton workshopId={workshop.id} isFavorited={workshop.is_favorited} />
        </div>
      </div>
      <p className="text-xs text-slate-500">主催: {workshop.facilitator_name}</p>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{workshop.description}</p>
      <dl className="mt-3 space-y-1 text-sm text-slate-500">
        <div className="flex gap-2">
          <dt className="font-medium">日時:</dt>
          <dd>{formatDateTime(workshop.start_at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">場所:</dt>
          <dd>
            <span
              className={`mr-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                workshop.location_type === 'online'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {workshop.location_type === 'online' ? 'オンライン' : '会場'}
            </span>
            {workshop.location}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">参加費:</dt>
          <dd className={workshop.price > 0 ? 'font-semibold text-slate-900' : 'font-semibold text-emerald-600'}>
            {formatPrice(workshop.price)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">定員:</dt>
          <dd className={isFull ? 'font-semibold text-red-600' : ''}>
            {workshop.reserved_count} / {workshop.capacity}
            {isFull ? '(満員)' : ''}
          </dd>
        </div>
      </dl>
    </Link>
  )
}
