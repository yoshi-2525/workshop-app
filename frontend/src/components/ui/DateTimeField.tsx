import { useEffect, useId, useRef, useState } from 'react'
import { DatePicker } from '@/components/ui/DatePicker'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { pad2 } from '@/utils/date'

// 時刻は「時」と「分」のセレクトで選ぶ。分は 5 分刻み
const MINUTE_STEP = 5
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => pad2(i))
const MINUTE_OPTIONS = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad2(i * MINUTE_STEP))

const SELECT_CLASS =
  'w-16 rounded-md border border-border bg-surface px-2 py-2 text-sm focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted'

interface DateTimeFieldProps {
  label: string
  // <input type="datetime-local"> と同じ YYYY-MM-DDTHH:mm 形式。未入力は ''
  value: string
  // 日付と時刻の両方がそろったときだけ値を返し、どちらかが欠けていれば '' を返す
  onChange: (value: string) => void
  // これより前の日付をカレンダーで選べなくする(YYYY-MM-DD)。昨日以前はこの指定に関係なく選べない
  minDate?: string
  // 日付を選んだ時点で(時刻の入力を待たずに)選んだ日付を返す(YYYY-MM-DD)
  onDateChange?: (date: string) => void
  // この日付が変わったら、日付を自動でこの日付にそろえる(YYYY-MM-DD)。
  // ただし、利用者が別の日付(この日付より後)を選んでいる場合はそのままにする
  followDate?: string
  // 必須項目の印をラベルに付ける
  required?: boolean
  // 日付・時刻を変更できないようにする(入力済みの値は表示したまま)
  disabled?: boolean
}

// 日付は DatePicker のカレンダー、時刻は「時」「分」のセレクト(分は 5 分刻み)で入力する
export function DateTimeField({
  label,
  value,
  onChange,
  minDate,
  onDateChange,
  followDate,
  required = false,
  disabled = false,
}: DateTimeFieldProps) {
  const [date, setDate] = useState(value.slice(0, 10))
  const [hour, setHour] = useState(value.slice(11, 13))
  const [minute, setMinute] = useState(value.slice(14, 16))
  // 編集画面で既存の値が後から読み込まれたときに、入力欄へ反映する
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (value) {
      setDate(value.slice(0, 10))
      setHour(value.slice(11, 13))
      setMinute(value.slice(14, 16))
    }
  }

  const hourId = useId()
  const minuteId = useId()
  // 時と分の両方がそろったときだけ時刻とみなす
  const time = hour && minute ? `${hour}:${minute}` : ''
  // 5 分刻みでない分(以前に保存したデータなど)も、選択肢に加えてそのまま表示する
  const minuteOptions =
    minute && !MINUTE_OPTIONS.includes(minute) ? [...MINUTE_OPTIONS, minute].sort() : MINUTE_OPTIONS

  function emit(nextDate: string, nextTime: string) {
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : '')
  }

  function handleChangeDate(next: string) {
    setDate(next)
    emit(next, time)
    onDateChange?.(next)
  }

  // followDate が変わったときに日付をそろえる。
  // 未入力のとき・前の followDate と同じ日付だったとき(自動で入れた日付のまま)・followDate より前になったときが対象。
  // 親の値も更新するので、描画中ではなく effect で行う
  const prevFollowDateRef = useRef(followDate)
  useEffect(() => {
    const prevFollowDate = prevFollowDateRef.current
    prevFollowDateRef.current = followDate
    if (disabled || !followDate || followDate === prevFollowDate) return
    if (date && date !== prevFollowDate && date >= followDate) return
    setDate(followDate)
    emit(followDate, time)
    // followDate の変化だけをきっかけにする(日付・時刻の変更では動かさない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followDate])

  function handleChangeHour(next: string) {
    // 時だけ選んで分が未選択なら、分は 00 にしておく
    const nextMinute = next && !minute ? '00' : minute
    setHour(next)
    setMinute(nextMinute)
    emit(date, next && nextMinute ? `${next}:${nextMinute}` : '')
  }

  function handleChangeMinute(next: string) {
    setMinute(next)
    emit(date, hour && next ? `${hour}:${next}` : '')
  }

  return (
    <div>
      <span className="block text-sm font-medium text-fg-secondary">
        {label}
        {required && <RequiredMark />}
      </span>
      <div className="mt-1 flex gap-2">
        <DatePicker
          label={label}
          value={date}
          onChange={handleChangeDate}
          minDate={minDate}
          disablePast
          disabled={disabled}
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          <label htmlFor={hourId} className="sr-only">
            {label}の時
          </label>
          <select
            id={hourId}
            required={required}
            disabled={disabled}
            value={hour}
            onChange={(e) => handleChangeHour(e.target.value)}
            className={`${SELECT_CLASS} ${hour ? 'text-fg' : 'text-fg-subtle'}`}
          >
            <option value="">--</option>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h} className="text-fg">
                {h}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="text-sm text-fg-muted">
            :
          </span>
          <label htmlFor={minuteId} className="sr-only">
            {label}の分
          </label>
          <select
            id={minuteId}
            required={required}
            disabled={disabled}
            value={minute}
            onChange={(e) => handleChangeMinute(e.target.value)}
            className={`${SELECT_CLASS} ${minute ? 'text-fg' : 'text-fg-subtle'}`}
          >
            <option value="">--</option>
            {minuteOptions.map((m) => (
              <option key={m} value={m} className="text-fg">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
