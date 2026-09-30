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
