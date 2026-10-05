import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Workshop } from '@/types'
import { formatPrice } from '@/utils/format'
import { isReservationClosed, isWorkshopFull } from '@/utils/workshop'
import { LocationTypeBadge } from '@/components/workshop/LocationTypeBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { NoImage } from '@/components/ui/NoImage'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { PaperCard } from '@/components/ui/PaperCard'
import { useBackState } from '@/hooks/useBackState'

// 詳細ページの下に並べる、小さめのワークショップカード。
// リンクはタイトルだけにして、当たり判定(::after)をカード全体に広げる(WorkshopCard と同じ作り)。
// 面も WorkshopCard と同じ紙にする。余白が狭く角の折れが文字にかかるので、折れは付けない
function CompactWorkshopCard({ workshop }: { workshop: Workshop }) {
  const [imageFailed, setImageFailed] = useState(false)
  const isFull = isWorkshopFull(workshop)
  const isClosed = isReservationClosed(workshop)
  const backState = useBackState('前のワークショップ')

  return (
    <PaperCard interactive cornerFold={false} className="flex w-full flex-col p-2">
      {workshop.image_url && !imageFailed ? (
        <img
          src={workshop.image_url}
          alt=""
          loading="lazy"
          className="aspect-video w-full rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <NoImage className="rounded-md" />
      )}
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-fg">
        <Link
          to={`/workshops/${workshop.id}`}
          state={backState}
          className="after:absolute after:inset-0 after:rounded-lg focus:outline-none"
        >
          {workshop.title}
        </Link>
      </h3>
      <p className="mt-1 text-xs text-fg-muted"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></p>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-fg-muted">
        <LocationTypeBadge type={workshop.location_type} className="shrink-0" />
        <span className="truncate">{workshop.location}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        <span className="text-fg">{formatPrice(workshop.price)}</span>
        {workshop.viewer.is_reserved ? (
          <span className="font-medium text-indigo-200">予約済み</span>
        ) : (
          (isClosed ? (
            <span className="font-semibold text-fg-muted">受付終了</span>
          ) : (
            isFull && <span className="font-semibold text-red-300">満員</span>
          ))
        )}
      </p>
    </PaperCard>
  )
}

const NAV_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-fg-secondary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface'

interface RelatedWorkshopSectionProps {
  title: string
  workshops: Workshop[]
  // 見出しの右に置くリンクなど
  action?: ReactNode
}

// 関連するワークショップの1つの欄。カードを横に並べ、左右のボタン(またはスワイプ・横スクロール)で送る。
// 該当するものがなければ欄ごと出さない
export function RelatedWorkshopSection({ title, workshops, action }: RelatedWorkshopSectionProps) {
  const headingId = useId()
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  // スクロール位置から、前後に送れるかを決める(端数の誤差を 1px 見込む)
  const updateNav = useCallback(() => {
    const list = listRef.current
    if (!list) return
    setCanPrev(list.scrollLeft > 1)
    setCanNext(list.scrollLeft + list.clientWidth < list.scrollWidth - 1)
  }, [])

  // 画面幅が変わると 1 画面に入る枚数が変わるので、そのたびに判定し直す
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    updateNav()
    const observer = new ResizeObserver(updateNav)
    observer.observe(list)
    return () => observer.disconnect()
  }, [updateNav, workshops])

  // 1 画面分(表示中のカードの枚数分)ずつ送る
  function scrollByPage(direction: 1 | -1) {
    const list = listRef.current
    if (!list) return
    list.scrollBy({ left: direction * list.clientWidth, behavior: 'smooth' })
  }

  if (workshops.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold text-fg">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {/* すべてのカードが 1 画面に収まっているときはボタンを出さない */}
          {(canPrev || canNext) && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canPrev}
                aria-label={`${title}の前へ`}
                aria-controls={listId}
                className={NAV_BUTTON_CLASS}
              >
                <MaterialIcon name="chevron_left" className="text-[20px]" />
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canNext}
                aria-label={`${title}の次へ`}
                aria-controls={listId}
                className={NAV_BUTTON_CLASS}
              >
                <MaterialIcon name="chevron_right" className="text-[20px]" />
              </button>
            </div>
          )}
        </div>
      </div>
      {/* 狭い画面では 2 枚、sm 以上では 4 枚ずつ見える。スクロールバーは隠し、左右のボタンかスワイプで送る */}
      <ul
        id={listId}
        ref={listRef}
        onScroll={updateNav}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {workshops.map((workshop) => (
          <li
            key={workshop.id}
            className="flex w-[calc((100%-0.75rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2.25rem)/4)]"
          >
            <CompactWorkshopCard workshop={workshop} />
          </li>
        ))}
      </ul>
    </section>
  )
}
