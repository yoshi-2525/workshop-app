import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { listInquiries } from '@/api/inquiries'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import type { InquirySummary } from '@/types'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'

// 自分が関わる問い合わせの一覧。?workshop_id= を付けると1つのワークショップへの問い合わせだけを表示する
export function InquiriesPage() {
  const [searchParams] = useSearchParams()
  const workshopId = parseIdParam(searchParams.get('workshop_id') ?? undefined) ?? undefined
  const [inquiries, setInquiries] = useState<InquirySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    listInquiries(workshopId, controller.signal)
      .then(setInquiries)
      .catch((err) => {
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, '問い合わせの取得に失敗しました'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [workshopId])

  // 絞り込み中は、見出しにワークショップ名を出す(一覧が空なら名前が分からないので出さない)
  const filteredTitle = workshopId !== undefined ? inquiries[0]?.workshop_title : undefined

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">問い合わせ</h1>
      {workshopId !== undefined && (
        <p className="mt-1 text-sm text-slate-500">
          {filteredTitle ? `「${filteredTitle}」への問い合わせ` : '選択したワークショップへの問い合わせ'}
          <Link to="/inquiries" className="ml-2 underline hover:text-slate-700">
            すべて表示
          </Link>
        </p>
      )}

      {loading && <p className="mt-6 text-slate-500">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && inquiries.length === 0 && (
        <p className="mt-6 text-slate-500">問い合わせはまだありません。</p>
      )}

      <ul className="mt-6 space-y-3">
        {inquiries.map((inquiry) => {
          const unread = inquiry.unread_count > 0
          return (
            <li key={inquiry.id}>
              <Link
                to={`/inquiries/${inquiry.id}`}
                className={`flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-md ${
                  unread ? 'border-border bg-slate-50' : 'border-border-muted bg-white'
                }`}
              >
                <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${unread ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                      {inquiry.counterpart_name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {inquiry.my_role === 'facilitator' ? '参加者からの問い合わせ' : '主催者への問い合わせ'}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">{formatDateTime(inquiry.last_message_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{inquiry.workshop_title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                      {inquiry.last_message}
                    </p>
                    {unread && (
                      <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        未読 {inquiry.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
