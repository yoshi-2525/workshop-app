import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkshop, listManagedWorkshops } from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { useApiResource } from '@/hooks/useApiResource'
import type { Workshop } from '@/types'
import { isWorkshopFinished } from '@/utils/workshop'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'

type Tab = 'upcoming' | 'draft' | 'history'

const TAB_OPTIONS: ToggleOption<Tab>[] = [
  { value: 'upcoming', label: '開催予定' },
  { value: 'draft', label: '下書き' },
  { value: 'history', label: '開催履歴' },
]

const EMPTY_MESSAGE: Record<Tab, string> = {
  upcoming: '開催予定のワークショップはありません。',
  draft: '下書きのワークショップはありません。',
  history: '開催履歴のワークショップはありません。',
}

function startTime(workshop: Workshop): number {
  return new Date(workshop.start_at).getTime()
}

export function ManageWorkshopsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const { data, loading, error: loadError, reload } = useApiResource(
    'managed-workshops',
    listManagedWorkshops,
    '取得に失敗しました',
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const error = loadError ?? deleteError

  // タブの中身を見出しごとに分ける。見出しのない最初のまとまりが、そのタブの本体
  const sections = useMemo((): { heading?: string; items: Workshop[] }[] => {
    const workshops = data ?? []
    // 中止したものは、公開中のものと混ざらないよう見出しを分けて下に並べる
    function splitCanceled(items: Workshop[]) {
      const canceled = items.filter((w) => w.status === 'canceled')
      return [
        { items: items.filter((w) => w.status !== 'canceled') },
        ...(canceled.length > 0 ? [{ heading: '中止したワークショップ', items: canceled }] : []),
      ]
    }

    switch (tab) {
      // 開催予定・開催履歴は公開したもの(公開中・中止)だけ。終了日時を過ぎたかどうかで振り分ける
      case 'upcoming':
        return splitCanceled(
          workshops
            .filter((w) => w.status !== 'draft' && !isWorkshopFinished(w))
            .sort((a, b) => startTime(a) - startTime(b)),
        )
      case 'history':
        return splitCanceled(
          workshops
            .filter((w) => w.status !== 'draft' && isWorkshopFinished(w))
            .sort((a, b) => startTime(b) - startTime(a)),
        )
      // 下書きは開催日時に関係なくここにまとめる
      case 'draft':
        return [
          { items: workshops.filter((w) => w.status === 'draft').sort((a, b) => startTime(a) - startTime(b)) },
        ]
    }
  }, [data, tab])

  async function handleDelete(id: number) {
    if (!confirm('このワークショップを削除しますか?')) return
    setDeleteError(null)
    try {
      await deleteWorkshop(id)
      reload()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, '削除に失敗しました'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">ワークショップ管理</h1>
        <Link
          to="/manage/workshops/new"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          新規作成
        </Link>
      </div>

      <ToggleGroup
        label="表示するワークショップ"
        hideLabel
        options={TAB_OPTIONS}
        value={tab}
        onChange={setTab}
        className="mt-4"
      />

      {loading && <p className="mt-6 text-fg-muted">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-300">
          {error}
        </p>
      )}
      {!loading && sections.map((section) => (
        <section key={section.heading ?? 'main'} className="mt-6">
          {section.heading && <h2 className="mb-3 text-base font-semibold text-fg-secondary">{section.heading}</h2>}
          {section.items.length === 0 ? (
            <p className="text-fg-muted">{EMPTY_MESSAGE[tab]}</p>
          ) : (
            <ul className="space-y-3">
              {section.items.map((workshop) => (
                <li
                  key={workshop.id}
                  className="flex items-center justify-between rounded-lg border border-border-muted bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    {workshop.image_url ? (
                      <img
                        src={workshop.image_url}
                        alt=""
                        className="aspect-video h-12 w-auto shrink-0 rounded-md object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="aspect-video h-12 shrink-0 rounded-md bg-surface-strong" />
                    )}
                    <div>
                      <p className="font-medium text-fg">{workshop.title}</p>
                      <p className="text-sm text-fg-muted"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></p>
                      {/* 下書きは予約を受け付けていないので、定員・参加者数は出さない */}
                      {workshop.status !== 'draft' && (
                        <p className="text-sm text-fg-muted">
                          定員：{workshop.capacity}名・参加者数：{workshop.reserved_count}名
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    {/* 下書きは参加者に公開されておらず、予約も問い合わせも受けないので出さない */}
                    {workshop.status !== 'draft' && (
                      <>
                        <Link
                          to={`/manage/workshops/${workshop.id}/reservations`}
                          aria-label={`${workshop.title}の予約・出欠`}
                          className="rounded-md border border-border px-3 py-1.5 text-fg-secondary hover:bg-surface-muted"
                        >
                          予約・出欠
                        </Link>
                        <Link
                          to={`/inquiries?workshop_id=${workshop.id}`}
                          aria-label={`${workshop.title}への問い合わせ・お知らせ`}
                          className="rounded-md border border-border px-3 py-1.5 text-fg-secondary hover:bg-surface-muted"
                        >
                          問い合わせ・お知らせ
                        </Link>
                      </>
                    )}
                    {/* 開催済み・中止のワークショップは編集できない */}
                    {!isWorkshopFinished(workshop) && workshop.status !== 'canceled' && (
                      <Link
                        to={`/manage/workshops/${workshop.id}/edit`}
                        aria-label={`${workshop.title}を編集`}
                        className="rounded-md border border-border px-3 py-1.5 text-fg-secondary hover:bg-surface-muted"
                      >
                        編集
                      </Link>
                    )}
                    {/* 削除できるのは下書きだけ。一度公開したもの(公開中・中止)は記録として残す
                        (開催前に取りやめるときは「中止」を使う) */}
                    {workshop.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(workshop.id)}
                        aria-label={`${workshop.title}を削除`}
                        className="rounded-md border border-red-400/30 px-3 py-1.5 text-red-300 hover:bg-red-400/10"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
