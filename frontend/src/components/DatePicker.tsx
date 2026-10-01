import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { DayPicker, type Matcher } from '@daypicker/react'
import { ja } from '@daypicker/react/locale'
import '@daypicker/react/style.css'
import { parseDateInput, toDateInputValue } from '../utils/date'


// カレンダーの見た目。ライブラリの CSS は .rdp-root 自身に変数を定義しているため、
// 親要素で指定しても上書きされる。style などでルート要素・各部品に直接渡して上書きする
// (変数の一覧は node_modules/react-day-picker/src/style.css の冒頭を参照。ファイル自体は編集しない)
//
// 大きさはライブラリの初期値の約 80%。バランスが崩れないよう、マス・ボタン・矢印・文字を同じ比率で縮める
// (初期値: マス 44px / ボタン 42px / 矢印ボタン 36px / 見出しの高さ 44px / 文字 16px / 見出し 18px)
const CALENDAR_STYLE = {
  '--rdp-accent-color': 'var(--color-accent)',
  '--rdp-accent-background-color': 'var(--color-slate-100)',
  '--rdp-day-width': '35px',
  '--rdp-day-height': '35px',
  // ボタンはマスより 2px 小さくする(初期値と同じ差)
  '--rdp-day_button-width': '33px',
  '--rdp-day_button-height': '33px',
  '--rdp-nav_button-width': '29px',
  '--rdp-nav_button-height': '29px',
  '--rdp-nav-height': '35px',
  '--rdp-weekday-padding': '0.4rem 0',
  // 日付の数字はこの大きさを引き継ぐ。フォームの入力欄(text-sm)とそろえる
  fontSize: '0.875rem',
} as CSSProperties

// 月の見出しと選択中の日付は、ライブラリが固定の大きさ(font-size: large = 18px)を指定しているので個別に縮める
const CALENDAR_PART_STYLES = {
  month_caption: { fontSize: '0.9375rem' },
  chevron: { width: 19, height: 19 },
}
const CALENDAR_MODIFIER_STYLES = {
  selected: { fontSize: '0.9375rem' },
}

const SIZE_CLASSES = {
  md: 'py-2',
  sm: 'py-1.5',
}

interface DatePickerProps {
  // 読み上げ用の名前(例: 開始日時)。ボタンとカレンダーのダイアログの名前に使う
  label: string
  // <input type="date"> と同じ YYYY-MM-DD 形式。未選択は ''
  value: string
  onChange: (value: string) => void
  // これより前 / 後の日付をカレンダーで選べなくする(YYYY-MM-DD)
  minDate?: string
  maxDate?: string
  // 昨日以前の日付を選べなくし、今月より前の月へも移動できなくする
  disablePast?: boolean
  // 選択を取り消せるようにする(カレンダーに「クリア」ボタンを出す)
  clearable?: boolean
  placeholder?: string
  // 入力エラーがあるときに枠を赤くし、エラーメッセージの要素とひもづける
  invalid?: boolean
  describedBy?: string
  size?: keyof typeof SIZE_CLASSES
  // 外側の要素に付けるクラス(幅の指定など)
  className?: string
}

// ボタンを押すと DayPicker のカレンダーを開き、日付を1つ選ぶ
export function DatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disablePast = false,
  clearable = false,
  placeholder = '日付を選択',
  invalid = false,
  describedBy,
  size = 'md',
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const calendarId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // カレンダーの外側のクリックや Esc キーで閉じる
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleSelect(selected: Date | undefined) {
    // 選択中の日付をもう一度押すと undefined が来る。取り消せない場合は何もしない
    if (!selected && !clearable) return
    onChange(selected ? toDateInputValue(selected) : '')
    close()
  }

  function handleClear() {
    onChange('')
    close()
  }

  const selectedDate = value ? parseDateInput(value) : undefined
  const now = new Date()
  // 今日は選べる
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const disabled: Matcher[] = [
    ...(disablePast ? [{ before: today }] : []),
    ...(minDate ? [{ before: parseDateInput(minDate) }] : []),
    ...(maxDate ? [{ after: parseDateInput(maxDate) }] : []),
  ]
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    : placeholder

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? calendarId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-md border bg-white px-3 text-left text-sm focus-ring focus:outline-none ${
          SIZE_CLASSES[size]
        } ${invalid ? 'border-red-500' : 'border-border'} ${
          selectedDate ? 'text-slate-900' : 'text-slate-400'
        }`}
      >
        {/* 読み上げは「開始日時 2026年10月1日(木)」のように、名前と選択中の日付をつなげる */}
        <span className="sr-only">{label} </span>
        {dateLabel}
      </button>
      {open && (
        <div
          id={calendarId}
          role="dialog"
          aria-label={`${label}を選択`}
          className="absolute left-0 z-10 mt-1 rounded-lg border border-border-muted bg-white p-3 shadow-lg"
        >
          <DayPicker
            mode="single"
            locale={ja}
            style={CALENDAR_STYLE}
            styles={CALENDAR_PART_STYLES}
            modifiersStyles={CALENDAR_MODIFIER_STYLES}
            selected={selectedDate}
            onSelect={handleSelect}
            startMonth={disablePast ? currentMonth : undefined}
            defaultMonth={
              selectedDate ??
              (minDate ? parseDateInput(minDate) : maxDate ? parseDateInput(maxDate) : undefined)
            }
            disabled={disabled}
            autoFocus
          />
          {clearable && selectedDate && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-ring focus:outline-none"
              >
                クリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
