import { useEffect, useId, useRef, useState } from 'react'
import { DayPicker } from '@daypicker/react'
import { ja } from '@daypicker/react/locale'
import '@daypicker/react/style.css'
import { CALENDAR_MODIFIER_STYLES, CALENDAR_PART_STYLES, CALENDAR_STYLE } from '@/components/ui/DatePicker'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { addDays, getDayInfo, parseDateInput, toDateInputValue } from '@/utils/date'

// 帯に並べる日数(firstDate から)
const STRIP_DAYS = 14

// 曜日の文字色。土曜は青、日曜・祝日は赤(置かれた面の色に合わせて、紙の上では濃いめになる)
const WEEKDAY_COLOR = {
  weekday: 'text-fg-muted',
  saturday: 'text-sky-300 [.theme-paper_&]:text-sky-700',
  holiday: 'text-red-300 [.theme-paper_&]:text-red-700',
}

interface DateStripPickerProps {
  // 読み上げ用の名前(例: 開催日)
  label: string
  // 選べる最初の日(0時)。帯はこの日から並べ、カレンダーでもこれより前の日は選べない
  firstDate: Date
  // 選んだ日(YYYY-MM-DD)。未選択は ''
  value: string
  onChange: (value: string) => void
  // 1日では表せない条件(以前の URL の「直近1週間」など)で絞っているときに出す文字。× で外せる
  presetLabel?: string
  disabled?: boolean
}

// 日付を1日だけ選ぶ。firstDate から2週間分の日付を「曜日＋日付」のボタンで横に並べ(収まらなければ横にスクロールする)、
// それより先の日は右端の「カレンダー」から選ぶ。
// 選んだ日は差し色になり、ほかの日は控えめな色になる。選んだ日をもう一度押すと解除する
export function DateStripPicker({
  label,
  firstDate,
  value,
  onChange,
  presetLabel,
  disabled = false,
}: DateStripPickerProps) {
  const [open, setOpen] = useState(false)
  const calendarId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  // カレンダーの外側のクリックや Esc キーで閉じる
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        calendarButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const tomorrow = addDays(new Date(), 1)
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(firstDate, i))
  const stripValues = days.map(toDateInputValue)
  // 帯より先の日をカレンダーで選んだときは、帯の後ろにその日を足して見せる
  const outsideStrip = value && !stripValues.includes(value) ? parseDateInput(value) : null
  const hasSelection = Boolean(value || presetLabel)

  function toggle(day: string) {
    onChange(value === day ? '' : day)
  }

  function handleCalendarSelect(selected: Date | undefined) {
    onChange(selected ? toDateInputValue(selected) : '')
    setOpen(false)
    calendarButtonRef.current?.focus()
  }

  function dayButton(date: Date, key: string) {
    const day = toDateInputValue(date)
    const selected = value === day
    const info = getDayInfo(date)
    const isTomorrow = day === toDateInputValue(tomorrow)
    const dateLabel = isTomorrow ? '明日' : `${date.getMonth() + 1}/${date.getDate()}`
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggle(day)}
        disabled={disabled}
        aria-pressed={selected}
        // 読み上げ名は画面の文字(「明日」「10/18」)で始め、音声操作でも同じ言葉で押せるようにする
        aria-label={`${dateLabel}(${info.label})${isTomorrow ? `、${date.getMonth() + 1}/${date.getDate()}` : ''}`}
        className={`w-[3.375rem] shrink-0 rounded-lg border py-1.5 text-center transition focus-ring focus:outline-none disabled:cursor-not-allowed ${
          selected
            ? 'border-accent bg-accent text-accent-foreground'
            : // 選んでいない日は、不透明度ではなく色を1段控えめにする(押せるボタンなので文字のコントラストは保つ)
              `bg-surface enabled:hover:bg-surface-strong disabled:opacity-40 ${
                hasSelection ? 'border-border-muted text-fg-muted enabled:hover:text-fg' : 'border-border text-fg'
              }`
        }`}
      >
        <span className={`block text-[11px] ${selected ? 'text-accent-foreground/70' : WEEKDAY_COLOR[info.kind]}`}>
          {info.label}
        </span>
        <span className="block text-[13px] font-semibold">{dateLabel}</span>
      </button>
    )
  }

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      {/* 日付は折り返さずに横へスクロールする。フォーカスの輪が切れないよう、内側に余白をとる */}
      <div className="-m-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto p-1 [scrollbar-width:thin]">
        {days.map((date) => dayButton(date, toDateInputValue(date)))}
        {outsideStrip && dayButton(outsideStrip, 'outside')}
        {presetLabel && (
          <span className="inline-flex h-[3.125rem] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-accent bg-accent pl-3 pr-1 text-[13px] font-semibold text-accent-foreground">
            {presetLabel}
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              aria-label={`${presetLabel}の指定を外す`}
              className="inline-flex h-6 w-6 items-center justify-center rounded focus-ring focus:outline-none"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        )}
      </div>
      <div ref={containerRef} className="relative shrink-0">
        <button
          ref={calendarButtonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? calendarId : undefined}
          className="inline-flex h-[3.125rem] items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-[13px] text-fg-secondary transition-colors hover:bg-surface-strong focus-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MaterialIcon name="calendar_add_on" className="text-[18px] text-accent" />
          カレンダー
          <span className="sr-only">で{label}を選ぶ</span>
        </button>
        {open && !disabled && (
          <div
            id={calendarId}
            role="dialog"
            aria-label={`${label}を選択`}
            className="absolute right-0 top-full z-10 mt-1 rounded-lg border border-border bg-surface p-3 shadow-lg"
          >
            <DayPicker
              mode="single"
              locale={ja}
              style={CALENDAR_STYLE}
              styles={CALENDAR_PART_STYLES}
              modifiersStyles={CALENDAR_MODIFIER_STYLES}
              selected={value ? parseDateInput(value) : undefined}
              onSelect={handleCalendarSelect}
              startMonth={new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)}
              defaultMonth={value ? parseDateInput(value) : undefined}
              disabled={{ before: firstDate }}
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  )
}
