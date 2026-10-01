// 現在ページの前後に表示するページ数
const SIBLING_COUNT = 1

type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

// 例: 全10ページで5ページ目 → [1, '…', 4, 5, 6, '…', 10]
function buildPageItems(current: number, totalPages: number): PageItem[] {
  const start = Math.max(2, current - SIBLING_COUNT)
  const end = Math.min(totalPages - 1, current + SIBLING_COUNT)
  const items: PageItem[] = [1]
  if (start > 2) items.push('ellipsis-start')
  for (let p = start; p <= end; p++) items.push(p)
  if (end < totalPages - 1) items.push('ellipsis-end')
  if (totalPages > 1) items.push(totalPages)
  return items
}

export function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
}: {
  page: number
  totalPages: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  if (totalPages <= 1) return null

  const navButton =
    'rounded-md border border-border px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav aria-label="ページ送り" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        className={navButton}
      >
        前へ
      </button>
      <ul className="flex flex-wrap items-center gap-1">
        {buildPageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                onClick={() => onChange(item)}
                disabled={disabled}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`${item}ページ目`}
                className={`min-w-9 rounded-md px-3 py-1.5 text-sm font-medium transition focus-ring focus:outline-none disabled:cursor-not-allowed ${
                  item === page ? 'bg-accent text-accent-foreground' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-slate-400">
              …
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
        className={navButton}
      >
        次へ
      </button>
    </nav>
  )
}
