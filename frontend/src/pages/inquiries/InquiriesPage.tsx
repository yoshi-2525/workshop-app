import { Link, useSearchParams } from 'react-router-dom'
import { listInquiries } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { BroadcastComposer } from '@/components/inquiry/BroadcastComposer'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'

// 自分が関わる問い合わせの一覧。?workshop_id= を付けると1つのワークショップへの問い合わせだけを表示する
export function InquiriesPage() {
  const [searchParams] = useSearchParams()
  const workshopId = parseIdParam(searchParams.get('workshop_id') ?? undefined) ?? undefined
  const { user } = useAuth()
  const { data, loading, error, reload } = useApiResource(
    `inquiries:${workshopId ?? 'all'}`,
    (signal) => listInquiries(workshopId, signal),
    '問い合わせの取得に失敗しました',
  )
  const inquiries = data ?? []
  // 絞り込み中は、そのワークショップの情報も読み込む(見出しと、お知らせの一斉送信に使う)。
  // 見られないワークショップでも問い合わせ一覧は表示できるので、失敗しても何も出さない
  const { data: workshop } = useApiResource(
    workshopId === undefined ? null : `workshop:${workshopId}`,
    (signal) => getWorkshop(workshopId!, signal),
    'ワークショップの取得に失敗しました',
  )
  // お知らせを一斉送信できるのは、公開中のワークショップの主催者だけ(バックエンドと同じ条件)
  const canBroadcast =
    workshop !== undefined && workshop.facilitator_id === user?.id && workshop.status === 'published'

  // 絞り込み中は、見出しにワークショップ名を出す
  const filteredTitle = workshopId !== undefined ? (workshop?.title ?? inquiries[0]?.workshop_title) : undefined

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-fg">問い合わせ</h1>
      {workshopId !== undefined && (
        <p className="mt-1 text-sm text-fg-muted">
          {filteredTitle ? `「${filteredTitle}」への問い合わせ` : '選択したワークショップへの問い合わせ'}
          <Link to="/inquiries" className="ml-2 underline hover:text-fg-secondary">
            すべて表示
          </Link>
        </p>
      )}

      {canBroadcast && <BroadcastComposer workshop={workshop} onSent={reload} />}

      {loading && <p className="mt-6 text-fg-muted">読み込み中...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-300">
          {error}
        </p>
      )}
      {!loading && !error && inquiries.length === 0 && (
        <p className="mt-6 text-fg-muted">問い合わせはまだありません。</p>
      )}

      <ul className="mt-6 space-y-3">
        {inquiries.map((inquiry) => {
          const unread = inquiry.unread_count > 0
          return (
            <li key={inquiry.id}>
              <Link
                to={`/inquiries/${inquiry.id}`}
                className={`flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-md ${
                  unread ? 'border-border bg-surface-muted' : 'border-border-muted bg-surface'
                }`}
              >
                <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${unread ? 'font-semibold text-fg' : 'text-fg'}`}>
                      {inquiry.counterpart_name}
                    </span>
                    <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs text-fg-secondary">
                      {inquiry.my_role === 'facilitator' ? '参加者からの問い合わせ' : '主催者への問い合わせ'}
                    </span>
                    <span className="ml-auto text-xs text-fg-muted">{formatDateTime(inquiry.last_message_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">{inquiry.workshop_title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-medium text-fg' : 'text-fg-secondary'}`}>
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
