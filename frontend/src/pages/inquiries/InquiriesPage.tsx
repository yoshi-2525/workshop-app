import { Link, useSearchParams } from 'react-router-dom'
import { listInquiries } from '@/api/inquiries'
import { getWorkshop } from '@/api/workshops'
import { BroadcastComposer } from '@/components/inquiry/BroadcastComposer'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { formatDateTime, formatTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { useBackState } from '@/hooks/useBackState'

// 一覧の時刻は「10/15 14:55」と短く出す。今年でなければ年も付ける
function formatShortDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const year = date.getFullYear() === new Date().getFullYear() ? '' : `${date.getFullYear()}/`
  return `${year}${date.getMonth() + 1}/${date.getDate()} ${formatTime(date)}`
}

// 自分が関わる問い合わせの一覧。?workshop_id= を付けると1つのワークショップへの問い合わせだけを表示する
export function InquiriesPage() {
  const backState = useBackState('問い合わせ一覧')
  const [searchParams] = useSearchParams()
  const workshopId = parseIdParam(searchParams.get('workshop_id') ?? undefined) ?? undefined
  const { user } = useAuth()
  const { data, loading, error, reload } = useApiResource(
    `inquiries:${workshopId ?? 'all'}`,
    (signal) => listInquiries(workshopId, signal),
    '問い合わせの取得に失敗しました',
  )
  const inquiries = data ?? []
  // 見出しの横に出す、未読のメッセージがある問い合わせの件数
  const unreadThreads = inquiries.filter((inquiry) => inquiry.unread_count > 0).length
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
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-fg">問い合わせ</h1>
        {unreadThreads > 0 && (
          <span className="text-sm text-fg-muted">
            未読 <span className="font-semibold text-accent">{unreadThreads}</span>件
          </span>
        )}
      </div>
      {workshopId === undefined ? (
        <p className="mt-2 text-sm text-fg-muted">
          主催者とのやり取りと、自分のワークショップに届いた問い合わせをまとめて表示しています。
        </p>
      ) : (
        <p className="mt-1 text-sm text-fg-muted">
          {filteredTitle ? `「${filteredTitle}」への問い合わせ` : '選択したワークショップへの問い合わせ'}
          <Link to="/inquiries" className="ml-2 underline hover:text-fg-secondary">
            すべて表示
          </Link>
        </p>
      )}

      {canBroadcast && <BroadcastComposer workshop={workshop} onSent={reload} />}

      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {!loading && !error && inquiries.length === 0 && (
        <p className="mt-6 text-fg-muted">問い合わせはまだありません。</p>
      )}

      {/* 問い合わせは暗い面のカード1枚にまとめ、区切り線で行を分ける。
          右端の列に最後のやり取りの時刻と、その下に未読メッセージの数を出す */}
      {inquiries.length > 0 && (
        <ul className="mt-6 divide-y divide-border-muted overflow-hidden rounded-lg bg-surface-muted shadow-card">
          {inquiries.map((inquiry) => {
            const unread = inquiry.unread_count > 0
            return (
              <li key={inquiry.id}>
                <Link
                  to={`/inquiries/${inquiry.id}`}
                  state={backState}
                  className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-strong/50 focus-ring focus:outline-hidden"
                >
                  <Avatar url={inquiry.counterpart_avatar_url} name={inquiry.counterpart_name} className="h-11 w-11 text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className={`text-[15px] text-fg ${unread ? 'font-semibold' : ''}`}>{inquiry.counterpart_name}</span>
                      <span className="text-xs text-fg-muted">
                        {inquiry.my_role === 'facilitator' ? '参加者からの問い合わせ' : '主催者への問い合わせ'}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[13px] text-fg-muted">{inquiry.workshop_title}</p>
                    <p className={`mt-1.5 truncate text-sm ${unread ? 'font-medium text-fg' : 'text-fg-secondary'}`}>
                      {inquiry.last_message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2.5 self-stretch">
                    <time
                      dateTime={new Date(inquiry.last_message_at).toISOString()}
                      title={formatDateTime(inquiry.last_message_at)}
                      className="text-xs tabular-nums text-fg-muted"
                    >
                      {formatShortDateTime(inquiry.last_message_at)}
                    </time>
                    {unread && (
                      <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent px-[7px] text-xs font-bold tabular-nums text-accent-foreground">
                        <span className="sr-only">未読 </span>
                        {inquiry.unread_count}
                        <span className="sr-only">件</span>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
