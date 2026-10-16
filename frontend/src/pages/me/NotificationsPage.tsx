import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listNotifications, markAllNotificationsRead } from '@/api/notifications'
import { useNotifications } from '@/context/NotificationContext'
import { useApiResource } from '@/hooks/useApiResource'
import type { Notification } from '@/types'
import { getDayInfo, toDateInputValue } from '@/utils/date'
import { formatDateTime, formatTime } from '@/utils/format'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { useBackState } from '@/hooks/useBackState'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

const typeLabel: Record<Notification['type'], string> = {
  cancellation: '中止',
  reminder: 'リマインダー',
  reservation_canceled: '参加キャンセル',
  new_workshop: '新着',
  payment_refunded: '返金',
  // 返金済みの知らせと取り違えないよう、ラベルも分ける
  payment_refund_failed: '返金不可',
}

// 種類は色ではなくアイコンの形とラベルで見分ける(色を使うのは未読の印だけ)ので、種類ごとに違う形にする。
// 新着は操作のボタン(＋)に見えないよう、カレンダーの形で「開催の知らせ」として示す。
// 使えるアイコンは index.html の icon_names に指定したものだけ
const typeIcon: Record<Notification['type'], string> = {
  cancellation: 'event_busy',
  reminder: 'schedule',
  reservation_canceled: 'person_remove',
  new_workshop: 'calendar_add_on',
  payment_refunded: 'currency_yen',
  payment_refund_failed: 'error',
}

// 予約・参加履歴の「予約履歴」タブ。キャンセル・中止も含めた予約の状態と返金の有無が分かる
const RESERVATION_HISTORY_PATH = '/reservations/history?tab=reservations'

// 通知を押したときの移動先。知りたいことが載っているページへ送る。
// ワークショップそのものの案内(リマインダー・新着)は詳細へ、予約やお金の状況の知らせは、
// 状態と返金の有無が分かる予約履歴へ
function notificationLink(notification: Notification): string {
  switch (notification.type) {
    case 'reminder':
    case 'new_workshop':
      return `/workshops/${notification.workshop_id}`
    case 'cancellation':
    case 'reservation_canceled':
    case 'payment_refunded':
    case 'payment_refund_failed':
      return RESERVATION_HISTORY_PATH
  }
}

interface DayGroup {
  key: string
  date: Date
  items: Notification[]
}

// 届いた日(端末の時間帯)ごとにまとめる。並び順は API の順(新しい順)のまま
function groupByDay(notifications: Notification[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const notification of notifications) {
    const date = new Date(notification.created_at)
    const key = toDateInputValue(date)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(notification)
    else groups.push({ key, date, items: [notification] })
  }
  return groups
}

// 日付の列に出す見出し。今日・昨日は言葉で示し、その下に日付を添える
function DayHeading({ date }: { date: Date }) {
  const now = new Date()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const key = toDateInputValue(date)
  const relative =
    key === toDateInputValue(now) ? '今日' : key === toDateInputValue(yesterday) ? '昨日' : null
  const year = date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}/`
  const day = `${year}${date.getMonth() + 1}/${date.getDate()}(${getDayInfo(date).label})`
  return (
    <h2 className="text-sm font-semibold tracking-wide text-fg-secondary sm:pt-1.5">
      {relative ?? day}
      {relative && <span className="ml-2 font-normal text-fg-muted sm:ml-0 sm:block">{day}</span>}
    </h2>
  )
}

export function NotificationsPage() {
  const backState = useBackState('通知')
  const { refreshUnreadCount } = useNotifications()
  const { data, loading, error } = useApiResource('notifications', listNotifications, '通知の取得に失敗しました')
  const notifications = data ?? []
  // 開いたときに未読だった件数。既読にしたあとも、この訪問の間は未読の印と件数を残して、どれが新しく届いたものか分かるようにする
  const unreadCount = notifications.filter((n) => !n.is_read).length

  // 通知は本文が一覧に全部出ていて、一覧を見た時点で読んだことになるので、開いたらすべて既読にする
  // (押したら既読にすると、未読を消すためだけに用のないページへ移ることになる)。
  // 既読にできなくても一覧は読めるので、失敗は知らせず、次に開いたときにまた既読にする
  const markedRef = useRef(false)
  useEffect(() => {
    if (markedRef.current || unreadCount === 0) return
    markedRef.current = true
    markAllNotificationsRead()
      .then(refreshUnreadCount)
      .catch(() => {})
  }, [unreadCount, refreshUnreadCount])

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-fg">通知</h1>
          {unreadCount > 0 && (
            <span className="text-sm text-fg-muted">
              未読 <span className="font-semibold text-accent">{unreadCount}</span>件
            </span>
          )}
        </div>
      </div>

      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {!loading && notifications.length === 0 && (
        <p className="mt-6 text-fg-muted">通知はまだありません。</p>
      )}

      {/* 左に日付の列、右に届いた順の通知をアイコンと縦線でつないで並べる。狭い画面では日付を上に出す */}
      {groupByDay(notifications).map((group) => (
        <section key={group.key} className="mt-9 grid gap-3 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <DayHeading date={group.date} />
          <ol>
            {group.items.map((notification, index) => {
              const isLast = index === group.items.length - 1
              // 本文にワークショップ名が入っていない通知(返金の失敗など)だけ、名前を添える
              const showTitle = !notification.message.includes(notification.workshop_title)
              return (
                <li key={notification.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-7'}`}>
                  {!isLast && (
                    <span aria-hidden="true" className="absolute bottom-0 left-5 top-11 w-px bg-secondary" />
                  )}
                  {/* 夜の地の上で種類がひと目で分かるよう、明るい面の丸にする。
                      縦線がアイコンの手前で途切れて見えるよう、地の色の輪で囲む */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-4 ring-background">
                    <MaterialIcon name={typeIcon[notification.type]} className="text-[22px]" />
                  </span>
                  <Link
                    to={notificationLink(notification)}
                    state={backState}
                    className="group -mx-2 -my-1 min-w-0 flex-1 rounded-md px-2 py-1 pt-[0.4rem] transition-colors hover:bg-surface/60 focus-ring focus:outline-hidden"
                  >
                    <span className="flex items-center gap-2 text-xs text-fg-muted">
                      <time
                        dateTime={new Date(notification.created_at).toISOString()}
                        title={formatDateTime(notification.created_at)}
                        className="tabular-nums"
                      >
                        {formatTime(notification.created_at)}
                      </time>
                      {/* 種類はアイコンの丸と同じ明るい面の札にして、時刻と区切りなしで並べても分かれて見えるようにする */}
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                        {typeLabel[notification.type]}
                      </span>
                      {!notification.is_read && (
                        <>
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                          <span className="sr-only">未読</span>
                        </>
                      )}
                    </span>
                    <span
                      className={`mt-1.5 block whitespace-pre-wrap break-words text-base leading-relaxed ${
                        notification.is_read ? 'font-medium text-fg-secondary' : 'font-semibold text-fg'
                      }`}
                    >
                      {notification.message}
                    </span>
                    {showTitle && (
                      <span className="mt-0.5 block truncate text-sm text-fg-muted">{notification.workshop_title}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
