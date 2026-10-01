import { useEffect, useRef } from 'react'
import type { InquiryMessage } from '../types'
import { formatDateTime } from '../utils/format'

// 問い合わせのやり取りを、自分のメッセージは右、相手のメッセージは左に並べて表示する
export function InquiryMessageList({ messages }: { messages: InquiryMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  // メッセージが増えたら、最新のメッセージが見えるところまでスクロールする
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">まだメッセージはありません。</p>
  }

  return (
    <>
      <ol aria-label="メッセージ" className="space-y-4">
        {messages.map((message) => (
          <li key={message.id} className={`flex flex-col ${message.is_mine ? 'items-end' : 'items-start'}`}>
            <p className="mb-1 text-xs text-slate-500">
              {message.is_mine ? 'あなた' : message.sender_name}
              <span className="ml-2">{formatDateTime(message.created_at)}</span>
            </p>
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                message.is_mine ? 'bg-accent text-accent-foreground' : 'border border-border-muted bg-white text-slate-800'
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
