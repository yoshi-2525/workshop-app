import { useId } from 'react'

export type ToggleOption<T extends string> = { value: T; label: string }

interface ToggleGroupProps<T extends string> {
  // グループの名前。hideLabel なら画面には出さず、読み上げにだけ使う
  label: string
  hideLabel?: boolean
  options: ToggleOption<T>[]
  value: T
  onChange: (next: T) => void
  className?: string
}

// 選択肢から1つを選ぶボタンの組(タブの切り替えや絞り込み条件など)。選択中のボタンは aria-pressed で伝える
export function ToggleGroup<T extends string>({
  label,
  hideLabel = false,
  options,
  value,
  onChange,
  className = '',
}: ToggleGroupProps<T>) {
  const labelId = useId()
  return (
    <div className={className}>
      <span id={labelId} className={hideLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-slate-700'}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex rounded-md border border-border p-0.5 text-sm"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded px-3 py-1.5 font-medium transition focus-ring focus:outline-none ${
              value === option.value ? 'bg-accent text-accent-foreground' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
