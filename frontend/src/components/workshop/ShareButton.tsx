import { useEffect, useId, useRef, useState } from 'react'
import { HoverLabel } from './HoverLabel'
import { MaterialIcon } from './MaterialIcon'

// コピーできたこと(または失敗したこと)を表示しておく時間
const MESSAGE_DISPLAY_MS = 2000

const MENU_ITEM_CLASS =
  'block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none'

// 各 SNS の共有画面の URL。どれも新しいタブで開く
function snsShareLinks(url: string, text: string) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  return [
    { label: 'X で共有', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { label: 'Facebook で共有', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'LINE で共有', href: `https://social-plugins.line.me/lineit/share?url=${u}` },
  ]
}

// 共有ボタン。押すとメニューを開き、SNS での共有とリンクのコピーを選べる。
// path は /workshops/1 などのこのサイト内のパス、title は共有するときの本文に使う
export function ShareButton({ path, title, className = '' }: { path: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const url = new URL(path, window.location.origin).href
  // スマホなど、端末の共有機能(Web Share API)が使えるときはメニューに加える
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), MESSAGE_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [message])

  // メニューの外を押したとき・Esc キーを押したときに閉じる
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleCopy() {
    setOpen(false)
    try {
      // navigator.clipboard は https か localhost でしか使えない
      await navigator.clipboard.writeText(url)
      setMessage({ text: 'リンクをコピーしました', isError: false })
    } catch {
      setMessage({ text: 'リンクをコピーできませんでした', isError: true })
    }
  }

  async function handleNativeShare() {
    setOpen(false)
    try {
      await navigator.share({ title, url })
    } catch {
      // 共有画面を閉じただけ(AbortError)のときも来るので、何もしない
    }
  }

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="共有"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="peer inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:text-slate-700"
      >
        <MaterialIcon name="share" className="text-[24px]" />
      </button>
      {/* メニューを開いている間は、ラベルがメニューの邪魔にならないよう出さない */}
      <HoverLabel text="共有" hidden={open} />
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="共有"
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-md border border-border-muted bg-white py-1 shadow-lg"
        >
          {snsShareLinks(url, title).map((item) => (
            <a
              key={item.label}
              role="menuitem"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={MENU_ITEM_CLASS}
            >
              {item.label}
            </a>
          ))}
          <div role="separator" className="my-1 border-t border-border-muted" />
          <button type="button" role="menuitem" onClick={handleCopy} className={MENU_ITEM_CLASS}>
            リンクをコピー
          </button>
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={handleNativeShare} className={MENU_ITEM_CLASS}>
              その他のアプリで共有
            </button>
          )}
        </div>
      )}
      {message && (
        <span
          role={message.isError ? 'alert' : 'status'}
          className={`absolute right-0 top-full z-20 mt-1 w-max rounded-md border bg-white px-2 py-1 text-xs shadow ${
            message.isError ? 'border-red-200 text-red-600' : 'border-border-muted text-slate-700'
          }`}
        >
          {message.text}
        </span>
      )}
    </span>
  )
}
