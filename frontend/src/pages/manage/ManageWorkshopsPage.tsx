import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkshop, listWorkshops, updateWorkshop } from '../../api/workshops'
import { extractErrorMessage } from '../../api/client'
import type { Workshop } from '../../types'
import { formatDateTime, formatPrice } from '../../utils/format'

const statusLabel: Record<Workshop['status'], string> = {
  draft: '下書き',
  published: '公開中',
  canceled: '中止',
}

function isPast(workshop: Workshop): boolean {
  return new Date(workshop.end_at).getTime() < Date.now()
}

type Tab = 'upcoming' | 'history'

export function ManageWorkshopsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listWorkshops({ mine: true })
      .then(setWorkshops)
      .catch((err) => setError(extractErrorMessage(err, '取得に失敗しました')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const upcoming = workshops.filter((w) => !isPast(w))
    const history = workshops.filter(isPast)
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

  async function handleCancel(workshop: Workshop) {
    if (!confirm('このワークショップを中止にしますか?予約済みの参加者には中止のお知らせが自動で届きます。')) return
    try {
      await updateWorkshop(workshop.id, {
        title: workshop.title,
        description: workshop.description,
        location_type: workshop.location_type,
        location: workshop.location,
        start_at: workshop.start_at,
        end_at: workshop.end_at,
        capacity: workshop.capacity,
        price: workshop.price,
        cancellation_policy: workshop.cancellation_policy,
        status: 'canceled',
      })
      load()
    } catch (err) {
      setError(extractErrorMessage(err, '中止処理に失敗しました'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">ワークショップ管理</h1>
        <Link
          to="/manage/workshops/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          新規作成
        </Link>
      </div>

      <div className="mt-4 inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            tab === 'upcoming' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          開催予定
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            tab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          開催履歴
        </button>
      </div>

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && <p className="mt-6 text-red-600">{error}</p>}
      {!loading && filtered.length === 0 && (
        <p className="mt-6 text-slate-500">
          {tab === 'upcoming' ? '開催予定のワークショップはありません。' : '開催履歴のワークショップはありません。'}
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {filtered.map((workshop) => (
          <li
            key={workshop.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              {workshop.image_url ? (
                <img
                  src={workshop.image_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-md bg-slate-100" />
              )}
              <div>
                <p className="font-medium text-slate-900">{workshop.title}</p>
                <p className="text-sm text-slate-500">{formatDateTime(workshop.start_at)}</p>
                <p className="text-sm text-slate-500">
                  {statusLabel[workshop.status]} ・ {formatPrice(workshop.price)} ・ 予約{' '}
                  {workshop.reserved_count} / {workshop.capacity}
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <Link
                to={`/manage/workshops/${workshop.id}/reservations`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                予約状況
              </Link>
              <Link
                to={`/manage/workshops/${workshop.id}/edit`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                編集
              </Link>
              {tab === 'upcoming' && workshop.status !== 'canceled' && (
                <button
                  onClick={() => handleCancel(workshop)}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-amber-700 hover:bg-amber-50"
                >
                  中止する
                </button>
              )}
              <button
                onClick={() => handleDelete(workshop.id)}
                disabled={workshop.reserved_count > 0}
                title={workshop.reserved_count > 0 ? '予約者がいるため削除できません。中止をご利用ください' : undefined}
                className="rounded-md border border-red-300 px-3 py-1.5 text-red-600 enabled:hover:bg-red-50 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
