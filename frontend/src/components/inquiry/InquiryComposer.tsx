import { useId, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { INQUIRY_MESSAGE_MAX_LENGTH } from '@/utils/inquiry'

interface InquiryComposerProps {
  // 送信に成功したら resolve、失敗したら reject する。失敗したときは入力内容を残す
  onSend: (body: string) => Promise<void>
  label?: string
  placeholder?: string
}

export function InquiryComposer({ onSend, label = 'メッセージ', placeholder }: InquiryComposerProps) {
  const id = useId()
  const helpId = useId()
  const [body, setBody] = useState('')
  const errorId = useId()
  const [sending, setSending] = useState(false)
  const [emptyError, setEmptyError] = useState(false)

  // ボタンは送信中以外いつでも押せるようにし、空のまま押されたら入力を促す
  async function send() {
    if (sending) return
    if (body.trim().length === 0) {
      setEmptyError(true)
      return
    }
    setEmptyError(false)
    setSending(true)
    try {
      await onSend(body.trim())
      setBody('')
    } catch {
      // エラーの表示は呼び出し側が行う
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send()
  }

  // Enter は改行、Ctrl+Enter(Mac は ⌘+Enter)で送信する
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        maxLength={INQUIRY_MESSAGE_MAX_LENGTH}
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (emptyError) setEmptyError(false)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-describedby={emptyError ? `${errorId} ${helpId}` : helpId}
        aria-invalid={emptyError}
        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
      />
      {emptyError && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
          メッセージを入力してください
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p id={helpId} className="text-xs text-slate-500">
          Ctrl+Enter で送信 ・ {body.length} / {INQUIRY_MESSAGE_MAX_LENGTH} 文字
        </p>
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground enabled:hover:bg-accent-hover disabled:opacity-50"
        >
          {sending ? '送信中...' : '送信する'}
        </button>
      </div>
    </form>
  )
}
