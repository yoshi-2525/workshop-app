export type ChipOption<T extends string | number> = { value: T; label: string }

interface ChipGroupProps<T extends string | number> {
  // 画面に出している項目名の要素の id。グループの名前として読み上げる
  labelledBy: string
  options: ChipOption<T>[]
  value: T
  onChange: (next: T) => void
  disabled?: boolean
}

// 選択肢から1つを選ぶ丸いボタンの並び(検索欄の絞り込み条件など)。選択中のボタンは aria-pressed で伝える
export function ChipGroup<T extends string | number>({
  labelledBy,
  options,
  value,
  onChange,
  disabled = false,
}: ChipGroupProps<T>) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
          className={`h-8 rounded-full border px-3.5 text-[13px] transition focus-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            value === option.value
              ? 'border-accent bg-accent font-semibold text-accent-foreground'
              : 'border-border bg-surface text-fg-secondary enabled:hover:bg-surface-strong'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
