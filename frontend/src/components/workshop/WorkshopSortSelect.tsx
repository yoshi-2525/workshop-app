import { useId } from 'react'
import type { WorkshopSort } from '@/api/workshops'

const SORT_OPTIONS: { value: WorkshopSort; label: string }[] = [
  { value: 'start', label: '開催日時の近い順' },
  { value: 'newest', label: '公開日時の新しい順' },
  { value: 'price', label: '参加費の安い順' },
]

// ワークショップ一覧の「並び替え」。公開一覧とフォロー中の主催者の一覧で同じ選択肢を使う
export function WorkshopSortSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: WorkshopSort
  onChange: (next: WorkshopSort) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg-secondary">
        並び替え
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as WorkshopSort)}
        disabled={disabled}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg focus-ring focus:border-ring focus:outline-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
