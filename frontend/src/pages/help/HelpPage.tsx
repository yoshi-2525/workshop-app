import { Link } from 'react-router-dom'
import { HELP_DOCUMENTS } from '@/pages/help/helpDocuments'

// ヘルプ・規約の一覧。登録前にも規約を読めるよう、ログインしていなくても表示できる
export function HelpPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">ヘルプ・規約</h1>
      <ul className="mt-6 space-y-3">
        {HELP_DOCUMENTS.map((doc) => (
          <li key={doc.to}>
            <Link
              to={doc.to}
              className="flex items-center justify-between rounded-lg border border-border-muted bg-surface p-4 shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-fg">{doc.title}</p>
                <p className="mt-0.5 text-sm text-fg-muted">{doc.description}</p>
              </div>
              <span aria-hidden="true" className="text-fg-subtle">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
