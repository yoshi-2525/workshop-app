import { useId, useState, type ReactNode, type SubmitEvent } from 'react'
import { firstReservableDate, LOCATION_TYPE_OPTIONS } from '@/utils/workshop'
import { addDays, toDateInputValue } from '@/utils/date'
import { formatYen } from '@/utils/format'
import {
  dateRangeLabel,
  KEYWORD_MAX_LENGTH,
  type LocationTypeFilter,
  type WorkshopListState,
} from '@/utils/workshopListState'
import { ChipGroup, type ChipOption } from '@/components/ui/ChipGroup'
import { DateStripPicker } from '@/components/ui/DateStripPicker'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PaperCard } from '@/components/ui/PaperCard'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'

// 一覧の条件のうち、この検索欄で決めるもの(参加可能・並び替え・ページは一覧の側で扱う)
export type WorkshopSearchConditions = Pick<
  WorkshopListState,
  'q' | 'locationType' | 'price' | 'maxPrice' | 'date' | 'from' | 'to'
>

const LOCATION_TYPE_FILTER_OPTIONS: ChipOption<LocationTypeFilter>[] = [
  { value: 'all', label: 'すべて' },
  ...LOCATION_TYPE_OPTIONS,
]

type PriceConditions = Pick<WorkshopSearchConditions, 'price' | 'maxPrice'>

// 参加費の選択肢。「すべて」「無料」と上限金額(無料のものも含めて、その金額以下)から1つ選ぶ
type PriceOption = ChipOption<string> & { conditions: PriceConditions }
const PRICE_OPTIONS: PriceOption[] = [
  { value: 'all', label: 'すべて', conditions: { price: 'all', maxPrice: undefined } },
  { value: 'free', label: '無料', conditions: { price: 'free', maxPrice: undefined } },
  ...[1000, 3000, 5000, 10000].map((maxPrice) => ({
    value: `max:${maxPrice}`,
    label: `〜${formatYen(maxPrice)}`,
    conditions: { price: 'all' as const, maxPrice },
  })),
]

// 選択肢で表せない条件を、選択中のチップとして先頭に出すときの値
const PRICE_PRESET_VALUE = 'preset'

// 参加費の入力の状態。選択肢で表せない条件は preset として持つ
type PriceDraft = { value: string } | { preset: PriceConditions; label: string }

// 確定済みの条件から、参加費の入力の状態を決める。選択肢にない条件(以前の URL の「有料のみ」や、選択肢にない上限金額)は、
// 選び直すまでそのまま残し、その旨を文字で見せる
function priceDraftOf(state: WorkshopListState): PriceDraft {
  const option = PRICE_OPTIONS.find(
    ({ conditions }) => conditions.price === state.price && conditions.maxPrice === state.maxPrice,
  )
  if (option) return { value: option.value }
  const preset = { price: state.price, maxPrice: state.maxPrice }
  const maxLabel = state.maxPrice === undefined ? '' : `〜${formatYen(state.maxPrice)}`
  if (state.price === 'paid') return { preset, label: maxLabel ? `有料・${maxLabel}` : '有料のみ' }
  return { preset, label: maxLabel }
}

function priceConditionsOf(draft: PriceDraft): PriceConditions {
  if ('preset' in draft) return draft.preset
  return (PRICE_OPTIONS.find((option) => option.value === draft.value) ?? PRICE_OPTIONS[0]).conditions
}

// 開催日は1日だけ選ぶ。その日から同じ日までの期間(date=range&from=&to=)として持つ
type DateDraft = { day: string } | { preset: Pick<WorkshopSearchConditions, 'date' | 'from' | 'to'>; label: string }

// 確定済みの条件から、開催日の入力の状態を決める。1日で表せない条件(以前の「直近1週間」や、何日かにわたる期間)は、
// 選び直すまでそのまま残し、その旨を文字で見せる
function dateDraftOf(state: WorkshopListState): DateDraft {
  if (state.date === 'all') return { day: '' }
  if (state.date === 'tomorrow') return { day: toDateInputValue(addDays(new Date(), 1)) }
  if (state.date === 'range' && state.from && state.from === state.to) return { day: state.from }
  const preset = { date: state.date, from: state.from, to: state.to }
  if (state.date === 'week') return { preset, label: '直近1週間' }
  return { preset, label: dateRangeLabel(state.from, state.to) }
}

function dateConditionsOf(draft: DateDraft): Pick<WorkshopSearchConditions, 'date' | 'from' | 'to'> {
  if ('preset' in draft) return draft.preset
  return draft.day ? { date: 'range', from: draft.day, to: draft.day } : { date: 'all', from: '', to: '' }
}

// 項目名を左に小さく置き、右に入力を並べる1行
function FilterRow({ label, labelId, children }: { label: string; labelId?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-2 sm:grid-cols-[4.75rem_minmax(0,1fr)] sm:gap-4">
      <span id={labelId} className="text-xs text-fg-muted">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface WorkshopSearchFormProps {
  // 確定済みの条件(URL から読んだもの)。入力欄の初期値にし、変わったら入力欄もそれに合わせる
  listState: WorkshopListState
  disabled?: boolean
  onSearch: (conditions: WorkshopSearchConditions) => void
}

// ワークショップ一覧の検索欄。入力中の条件はこの中だけで持ち、「検索」ボタン(キーワード欄では Enter)を押したときにまとめて確定する
export function WorkshopSearchForm({ listState, disabled = false, onSearch }: WorkshopSearchFormProps) {
  const [keywordQuery, setKeywordQuery] = useState(listState.q)
  const [locationTypeFilter, setLocationTypeFilter] = useState(listState.locationType)
  const [priceDraft, setPriceDraft] = useState(() => priceDraftOf(listState))
  const [dateDraft, setDateDraft] = useState(() => dateDraftOf(listState))

  // ブラウザの「戻る」やナビバーのリンクで URL(確定済みの条件)が変わったら、入力欄もそれに合わせる。
  // listState は URL が変わったときだけ作り直されるので、オブジェクトが変わったかで判定できる
  const [syncedState, setSyncedState] = useState(listState)
  if (listState !== syncedState) {
    setSyncedState(listState)
    setKeywordQuery(listState.q)
    setLocationTypeFilter(listState.locationType)
    setPriceDraft(priceDraftOf(listState))
    setDateDraft(dateDraftOf(listState))
  }

  const headingId = useId()
  const keywordId = useId()
  const locationTypeLabelId = useId()
  const priceLabelId = useId()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    onSearch({
      // 貼り付けなどで maxLength を超えた場合の保険
      q: keywordQuery.trim().slice(0, KEYWORD_MAX_LENGTH),
      locationType: locationTypeFilter,
      ...priceConditionsOf(priceDraft),
      ...dateConditionsOf(dateDraft),
    })
  }

  return (
    // 入力するところは紙のカード(アプリの決まり)。キーワードと絞り込みの条件をひとまとめにして、「検索」でまとめて確定する。
    // 中の入力欄・切り替え・ボタンは theme-paper で紙用の色に切り替わる
    <PaperCard as="section" aria-labelledby={headingId} cornerFold={false} className="mt-6 p-5 sm:px-6">
      <form role="search" aria-labelledby={headingId} onSubmit={handleSubmit}>
        <h3 id={headingId} className="text-[15px] font-semibold text-fg">
          対話をさがす
        </h3>
        <div className="relative mt-3">
          <MaterialIcon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-fg-muted"
          />
          <label htmlFor={keywordId} className="sr-only">
            キーワード
          </label>
          <input
            id={keywordId}
            type="search"
            maxLength={KEYWORD_MAX_LENGTH}
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder="キーワード（例: 哲学、働くこと）"
            className="h-12 w-full rounded-lg border border-border bg-surface pl-11 pr-4 text-[15px] text-fg placeholder:text-fg-subtle focus:border-ring focus-ring focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <FilterRow label="開催日">
              <DateStripPicker
                label="開催日"
                firstDate={firstReservableDate()}
                value={'day' in dateDraft ? dateDraft.day : ''}
                presetLabel={'preset' in dateDraft ? dateDraft.label : undefined}
                onChange={(day) => setDateDraft({ day })}
                disabled={disabled}
              />
            </FilterRow>
            <FilterRow label="開催形式" labelId={locationTypeLabelId}>
              <ChipGroup
                labelledBy={locationTypeLabelId}
                options={LOCATION_TYPE_FILTER_OPTIONS}
                value={locationTypeFilter}
                onChange={setLocationTypeFilter}
                disabled={disabled}
              />
            </FilterRow>
            <FilterRow label="参加費" labelId={priceLabelId}>
              <ChipGroup
                labelledBy={priceLabelId}
                options={
                  'preset' in priceDraft
                    ? [{ value: PRICE_PRESET_VALUE, label: priceDraft.label }, ...PRICE_OPTIONS]
                    : PRICE_OPTIONS
                }
                value={'preset' in priceDraft ? PRICE_PRESET_VALUE : priceDraft.value}
                onChange={(value) => {
                  if (value !== PRICE_PRESET_VALUE) setPriceDraft({ value })
                }}
                disabled={disabled}
              />
            </FilterRow>
          </div>
          <button type="submit" disabled={disabled} className={`ml-auto ${PRIMARY_BUTTON_CLASS}`}>
            検索
          </button>
        </div>
      </form>
    </PaperCard>
  )
}
