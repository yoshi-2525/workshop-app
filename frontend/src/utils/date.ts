import holiday_jp from '@holiday-jp/holiday_jp'

// <input type="date"> と同じ YYYY-MM-DD 形式の日付文字列を扱う。
// どれも端末の時間帯での日付として解釈する

// YYYY-MM-DD を、端末の時間帯でのその日の0時として解釈する
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// Date を、端末の時間帯での YYYY-MM-DD に変換する
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// Date を、端末の時間帯での YYYY-MM-DDTHH:mm(<input type="datetime-local"> と同じ形式)に変換する
export function toDateTimeInputValue(date: Date): string {
  return `${toDateInputValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// 曜日の表示ラベル(「土」「月・祝」など)と、文字色を決めるための日の種類
export interface DayInfo {
  label: string
  // 日曜・祝日は holiday(祝日が土曜と重なったときも holiday)
  kind: 'weekday' | 'saturday' | 'holiday'
}

// 端末の時間帯での日付として、曜日と祝日かどうかを調べる
export function getDayInfo(date: Date): DayInfo {
  const day = date.getDay()
  const weekday = WEEKDAY_LABELS[day]
  if (holiday_jp.isHoliday(toDateInputValue(date))) {
    return { label: day === 0 ? weekday : `${weekday}・祝`, kind: 'holiday' }
  }
  if (day === 0) return { label: weekday, kind: 'holiday' }
  if (day === 6) return { label: weekday, kind: 'saturday' }
  return { label: weekday, kind: 'weekday' }
}
