import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkshop, listManagedWorkshops } from '../../api/workshops'
import { extractErrorMessage } from '../../api/client'
import { ToggleGroup, type ToggleOption } from '../../components/ToggleGroup'
import type { Workshop } from '../../types'
import { isWorkshopFinished } from '../../utils/workshop'
import { WorkshopDateTime } from '../../components/WorkshopDateTime'

const statusLabel: Record<Workshop['status'], string> = {
  draft: '下書き',
  published: '公開中',
  canceled: '中止',
}

type Tab = 'upcoming' | 'history'

const TAB_OPTIONS: ToggleOption<Tab>[] = [
  { value: 'upcoming', label: '開催予定' },
  { value: 'history', label: '開催履歴' },
]

export function ManageWorkshopsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listManagedWorkshops()
      .then(setWorkshops)
      .catch((err) => setError(extractErrorMessage(err, '取得に失敗しました')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const upcoming = workshops.filter((w) => !isWorkshopFinished(w))
    const history = workshops.filter(isWorkshopFinished)
    upcoming.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    history.sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    return tab === 'upcoming' ? upcoming : history
  }, [workshops, tab])

  async function handleDelete(id: number) {
    if (!confirm('このワークショップを削除しますか?')) return
    try {
      await deleteWorkshop(id)
      load()
    } catch (err) {
      setError(extractErrorMessage(err, '削除に失敗しました'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">ワークショップ管理</h1>
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

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      {!loading && filtered.length === 0 && (
        <p className="mt-6 text-slate-500">
          {tab === 'upcoming' ? '開催予定のワークショップはありません。' : '開催履歴のワークショップはありません。'}
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {filtered.map((workshop) => (
          <li
            key={workshop.id}
            className="flex items-center justify-between rounded-lg border border-border-muted bg-white p-4"
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
                <div className="aspect-video h-12 shrink-0 rounded-md bg-slate-100" />
              )}
              <div>
                <p className="font-medium text-slate-900">{workshop.title}</p>
                <p className="text-sm text-slate-500"><WorkshopDateTime start={workshop.start_at} end={workshop.end_at} /></p>
                <p className="text-sm text-slate-500">
                  {statusLabel[workshop.status]} ・ 予約{' '}
                  {workshop.reserved_count} / {workshop.capacity}
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <Link
                to={`/manage/workshops/${workshop.id}/reservations`}
                className="rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                予約状況
              </Link>
              <Link
                to={`/inquiries?workshop_id=${workshop.id}`}
                className="rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                問い合わせ
              </Link>
              {/* 開催済み・中止のワークショップは編集できない */}
              {tab === 'upcoming' && workshop.status !== 'canceled' && (
                <Link
                  to={`/manage/workshops/${workshop.id}/edit`}
                  className="rounded-md border border-border px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                >
                  編集
                </Link>
              )}
              {/* 開催予定で公開中のものは削除できない(取りやめるときは「中止」を使う)。
                  予約者がいたものは参加者への記録として残すため、どの状態でも削除できない */}
              {(tab === 'history' || workshop.status !== 'published') && (
                <button
                  onClick={() => handleDelete(workshop.id)}
                  disabled={workshop.reserved_count > 0}
                  title={
                    workshop.reserved_count === 0
                      ? undefined
                      : workshop.status === 'canceled'
                        ? '予約者がいた中止済みのワークショップは、記録として残すため削除できません'
                        : '予約者がいるため削除できません。中止をご利用ください'
                  }
                  className="rounded-md border border-red-300 px-3 py-1.5 text-red-600 enabled:hover:bg-red-50 disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
