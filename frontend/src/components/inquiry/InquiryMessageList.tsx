import { useEffect, useRef } from 'react'
import type { InquiryMessage } from '@/types'
import { formatDateTime } from '@/utils/format'

// 問い合わせのやり取りを、自分のメッセージは右、相手のメッセージは左に並べて表示する
export function InquiryMessageList({ messages }: { messages: InquiryMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  // メッセージが増えたら、最新のメッセージが見えるところまでスクロールする
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-muted">まだメッセージはありません。</p>
  }

  return (
    <>
      <ol aria-label="メッセージ" className="space-y-4">
        {messages.map((message) => (
          <li key={message.id} className={`flex flex-col ${message.is_mine ? 'items-end' : 'items-start'}`}>
            <p className="mb-1 text-xs text-fg-muted">
              {message.is_mine ? 'あなた' : message.sender_name}
              <span className="ml-2">{formatDateTime(message.created_at)}</span>
              {/* 個別の返信と区別できるよう、一斉送信したお知らせには印を付ける */}
              {message.is_broadcast && (
                <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-200">
                  参加者全員へのお知らせ
                </span>
              )}
            </p>
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                message.is_mine ? 'bg-accent text-accent-foreground' : 'border border-border-muted bg-surface text-fg'
              }`}
            >
              {message.body}
            </p>
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </>
  )
}
