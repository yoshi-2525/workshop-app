import { getDayInfo, toDateInputValue } from '@/utils/date'
import { formatTime } from '@/utils/format'

type DateStyle = 'long' | 'medium'

// 日付と曜日。色を使いすぎないよう、土曜・日曜・祝日も平日と同じ色で表示する
function DatePart({ date, dateStyle }: { date: Date; dateStyle: DateStyle }) {
  return (
    <>
      {date.toLocaleDateString('ja-JP', { dateStyle })}({getDayInfo(date).label})
    </>
  )
}

// ワークショップの開催日時を「2026/10/03(土) 14:00〜17:00」の形で表示する。
// 終了が開始と同じ日なら終了側の日付は省略し、日をまたぐときは「〜2026/10/04(日) 10:00」のように日付も付ける。
// end を省くと、予約の締め切りなど1つの日時だけを同じ形で表示する
export function WorkshopDateTime({
  start,
  end,
  dateStyle = 'medium',
}: {
  start: string
  end?: string
  dateStyle?: DateStyle
}) {
  const startDate = new Date(start)
  const endDate = new Date(end ?? Number.NaN)
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
