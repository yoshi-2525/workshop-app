import { getDayInfo, toDateInputValue, type DayInfo } from '../utils/date'

// 白背景でコントラスト比 4.5:1 以上になる色を使う
const DAY_TEXT_CLASS: Record<DayInfo['kind'], string> = {
  weekday: '',
  saturday: 'text-blue-600',
  holiday: 'text-red-600',
}

type DateStyle = 'long' | 'medium'

const formatTime = (date: Date) => date.toLocaleTimeString('ja-JP', { timeStyle: 'short' })

// 日付と曜日。曜日の「(土)」の部分だけ、土曜なら青、日曜・祝日なら赤にする
function DatePart({ date, dateStyle }: { date: Date; dateStyle: DateStyle }) {
  const day = getDayInfo(date)
  return (
    <>
      {date.toLocaleDateString('ja-JP', { dateStyle })}
      <span className={DAY_TEXT_CLASS[day.kind]}>({day.label})</span>
    </>
  )
}

// ワークショップの開催日時を「2026/10/03(土) 14:00〜17:00」の形で表示する。
// 終了が開始と同じ日なら終了側の日付は省略し、日をまたぐときは「〜2026/10/04(日) 10:00」のように日付も付ける
export function WorkshopDateTime({
  start,
  end,
  dateStyle = 'medium',
}: {
  start: string
  end: string
  dateStyle?: DateStyle
}) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime())) return <>-</>

  const hasEnd = !Number.isNaN(endDate.getTime())
  const sameDay = hasEnd && toDateInputValue(startDate) === toDateInputValue(endDate)
  return (
    <span>
      <time dateTime={startDate.toISOString()}>
        <DatePart date={startDate} dateStyle={dateStyle} /> {formatTime(startDate)}
      </time>
      {hasEnd && (
        <>
          〜
          <time dateTime={endDate.toISOString()}>
            {!sameDay && (
              <>
                <DatePart date={endDate} dateStyle={dateStyle} />{' '}
              </>
            )}
            {formatTime(endDate)}
          </time>
        </>
      )}
    </span>
  )
}
