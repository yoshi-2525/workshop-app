import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Workshop } from '@/types'
import { formatPriceYen } from '@/utils/format'
import { priceTextClass } from '@/utils/workshop'
import { FavoriteButton } from '@/components/workshop/FavoriteButton'
import { LocationTypeBadge } from '@/components/workshop/LocationTypeBadge'
import { FewSeatsBadge, FullBadge } from '@/components/workshop/SeatStatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { NoImage } from '@/components/ui/NoImage'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'

// 項目名はアイコンで見せ、読み上げ用に文字のラベルも残す。
// 高さを文字1行分(1lh)にして、その中でアイコンを上下中央に置く。文字サイズを変えても1行目とそろい、
// 内容が折り返してもアイコンは1行目の横に並ぶ
function FieldIcon({ icon, label, className = '' }: { icon: string; label: string; className?: string }) {
  return (
    <dt className={`flex h-[1lh] shrink-0 items-center text-slate-400 ${className}`} title={label}>
      <MaterialIcon name={icon} className="text-lg" />
      <span className="sr-only">{label}</span>
    </dt>
  )
}

export function WorkshopCard({ workshop }: { workshop: Workshop }) {
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
          className="mb-2 aspect-video w-full rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <NoImage className="mb-1 rounded-md" />
      )}
      {/* タイトルが1行でも2行でも日時以降の位置がそろうよう、タイトル(最大2行)+主催の分の高さを確保する。
          主催はタイトルのすぐ下に出し、余りは主催の下に回す */}
      <div className="min-h-[4.5rem]">
        <div className="flex items-center justify-between gap-4">
          <h3 className="line-clamp-2 min-w-0 text-lg font-semibold text-slate-900" title={workshop.title}>
            <Link
              to={`/workshops/${workshop.id}`}
              className="after:absolute after:inset-0 after:rounded-lg focus:outline-none"
            >
              {workshop.title}
            </Link>
          </h3>
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {/* 満員はタイトルの横(予約済みと同じ並び)に出す。残席僅かは定員の右 */}
            <FullBadge workshop={workshop} />
            {workshop.viewer.is_reserved && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
                予約済み
              </span>
            )}
            {/* 共有とお気に入りは、それぞれ薄いグレーの丸で囲む */}
            <FavoriteButton
              workshopId={workshop.id}
              isFavorited={workshop.viewer.is_favorited}
              className="rounded-full bg-slate-50"
            />
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Avatar url={workshop.facilitator_avatar_url} name={workshop.facilitator_name} className="h-6 w-6 text-xs" />
          {workshop.facilitator_name}
        </p>
      </div>
      <dl className="mt-2 space-y-2 text-sm text-slate-500">
        <div className="flex gap-2">
          <FieldIcon icon="schedule" label="日時" />
          <dd><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></dd>
        </div>
        <div className="flex gap-2">
          <FieldIcon icon="location_on" label="場所" />
          <dd>
            <LocationTypeBadge type={workshop.location_type} className="mr-1" />
            {workshop.location}
          </dd>
        </div>
        {/* 参加費と定員は短いので1行に並べる(dl の中の div には dt・dd の組を複数入れられる) */}
        <div className="flex gap-2">
          <FieldIcon icon="currency_yen" label="参加費" />
          <dd className={priceTextClass(workshop.price)}>
            {formatPriceYen(workshop.price)}
          </dd>
          <FieldIcon icon="person" label="定員" className="ml-3" />
          <dd className="flex items-center gap-2">
            {workshop.capacity}名
            <FewSeatsBadge workshop={workshop} />
          </dd>
        </div>
      </dl>
    </div>
  )
}
