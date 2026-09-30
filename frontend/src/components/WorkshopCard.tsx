import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Workshop } from '../types'
import { formatDateTime, formatPrice } from '../utils/format'
import { isWorkshopFull, priceTextClass } from '../utils/workshop'
import { FavoriteButton } from './FavoriteButton'
import { LocationTypeBadge } from './LocationTypeBadge'
import { NoImage } from './NoImage'

export function WorkshopCard({ workshop }: { workshop: Workshop }) {
  const isFull = isWorkshopFull(workshop)
  // 画像の読み込みに失敗したときも、画像なしと同じ表示にしてカードの高さをそろえる
  const [imageFailed, setImageFailed] = useState(false)

  // リンクの中にボタンを入れられないので、リンクはタイトルだけにして、その当たり判定(::after)をカード全体に広げる。
  // お気に入りボタンは relative z-10 で、広げたリンクより手前に出す
  return (
    <div className="relative rounded-lg border border-border-muted bg-white p-4 shadow-sm transition focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      {workshop.image_url && !imageFailed ? (
        <img
          src={workshop.image_url}
          alt=""
          className="mb-3 aspect-video w-full rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <NoImage className="mb-3 rounded-md" />
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          <Link
            to={`/workshops/${workshop.id}`}
            className="after:absolute after:inset-0 after:rounded-lg focus:outline-none"
          >
            {workshop.title}
          </Link>
        </h3>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          {workshop.viewer.is_reserved && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              予約済み
            </span>
          )}
          <FavoriteButton workshopId={workshop.id} isFavorited={workshop.viewer.is_favorited} />
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
            <LocationTypeBadge type={workshop.location_type} className="mr-1" />
            {workshop.location}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">参加費:</dt>
          <dd className={priceTextClass(workshop.price)}>
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
    </div>
  )
}
