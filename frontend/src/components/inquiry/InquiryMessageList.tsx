import { useEffect, useRef } from 'react'
import type { InquiryMessage } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { CopyMessageButton } from '@/components/inquiry/CopyMessageButton'
import { getDayInfo, toDateInputValue } from '@/utils/date'
import { formatDateTime, formatTime } from '@/utils/format'

// 日付の区切りに出す「2026/10/13(火)」
function formatDay(date: Date): string {
  return `${date.toLocaleDateString('ja-JP', { dateStyle: 'medium' })}(${getDayInfo(date).label})`
}

interface InquiryMessageListProps {
  messages: InquiryMessage[]
  // 相手のメッセージの横に出すアイコン。メッセージには送り主のアイコンがないので、問い合わせの相手のものを使う
  counterpartAvatarUrl?: string
}

// 下からこの距離(px)以内までスクロールしていれば、いちばん下を見ているものとして扱う
const STICK_TO_BOTTOM_PX = 80

// 動きを減らす設定にしているときは、なめらかなスクロールをしない
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

// 問い合わせのやり取りを、自分のメッセージは右、相手のメッセージは左に並べて表示する。
// 日付が変わるところに区切りを入れ、各メッセージには時刻だけを添える。
// やり取りはこの欄の中だけでスクロールさせ、メッセージが増えてもページ全体は動かさない(送信欄が画面から外れないように)
export function InquiryMessageList({ messages, counterpartAvatarUrl = '' }: InquiryMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // いちばん下を見ているか。前のメッセージを読み返している間は、相手から届いても動かさない
  const stickToBottomRef = useRef(true)
  const prevLengthRef = useRef(0)

  // メッセージが増えたら、欄の中で最新のメッセージまでスクロールする。
  // 開いたときはすぐに、自分が送ったとき・いちばん下を見ているときに届いたときはなめらかに動かす
  useEffect(() => {
    const el = scrollRef.current
    const prevLength = prevLengthRef.current
    prevLengthRef.current = messages.length
    if (!el || messages.length <= prevLength) return
    const isInitial = prevLength === 0
    const sentByMe = messages[messages.length - 1].is_mine
    if (!isInitial && !sentByMe && !stickToBottomRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: isInitial ? 'auto' : scrollBehavior() })
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_PX
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="max-h-[min(60vh,40rem)] overflow-y-auto p-4 sm:p-5">
      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">まだメッセージはありません。</p>
      ) : (
        <ol aria-label="メッセージ" className="space-y-5">
          {messages.map((message, index) => {
            const createdAt = new Date(message.created_at)
            const day = toDateInputValue(createdAt)
            const showDay = index === 0 || toDateInputValue(new Date(messages[index - 1].created_at)) !== day
            // 吹き出しの横に、コピーボタンと時刻を縦に並べる。
            // 時刻だけを見せ、日付も含めた日時はマウスを乗せたときと読み上げで伝える
            const meta = (
              <div className={`flex shrink-0 flex-col gap-0.5 ${message.is_mine ? 'items-end' : 'items-start'}`}>
                <CopyMessageButton
                  text={message.body}
                  label={`${message.is_mine ? 'あなた' : `${message.sender_name}さん`}の ${formatTime(createdAt)} のメッセージ`}
                  align={message.is_mine ? 'start' : 'end'}
                />
                <time
                  dateTime={createdAt.toISOString()}
                  title={formatDateTime(message.created_at)}
                  className="text-xs tabular-nums text-fg-muted"
                >
                  {formatTime(createdAt)}
                </time>
              </div>
            )
            // 個別の返信と区別できるよう、一斉送信したお知らせには印を付ける
            const broadcastBadge = message.is_broadcast && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                参加者全員へのお知らせ
              </span>
            )
            return (
              <li key={message.id}>
                {showDay && (
                  <p className="mb-5 flex items-center gap-3 text-xs text-fg-muted">
                    <span aria-hidden="true" className="h-px flex-1 bg-border-muted" />
                    {formatDay(createdAt)}
                    <span aria-hidden="true" className="h-px flex-1 bg-border-muted" />
                  </p>
                )}
                {message.is_mine ? (
                  <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
                    {/* 自分のメッセージは名前を出さない。読み上げでは誰のメッセージかを伝える */}
                    <span className="sr-only">あなた</span>
                    {broadcastBadge}
                    {/* 読み上げ・Tab の順は相手のメッセージと同じ「本文 → コピー・時刻」にし、見た目だけ左右を入れ替える */}
                    <div className="flex flex-row-reverse items-end gap-2.5">
                      <p className="min-w-0 whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-accent-foreground">
                        {message.body}
                      </p>
                      {meta}
                    </div>
                  </div>
                ) : (
                  <div className="group flex max-w-[85%] items-end gap-2.5">
                    <Avatar url={counterpartAvatarUrl} name={message.sender_name} className="h-8 w-8 text-sm" />
                    <div className="min-w-0">
                      <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                        {message.sender_name}
                        {broadcastBadge}
                      </p>
                      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-border bg-surface-muted px-4 py-3 text-fg">
                        {message.body}
                      </p>
                    </div>
                    {meta}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
