import { useRef, useState } from 'react'
import { getAdminPayoutRequests, markPayoutPaid, rejectPayout } from '@/api/payouts'
import { BackLink } from '@/components/ui/BackLink'
import { Pagination } from '@/components/ui/Pagination'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { DANGER_SMALL_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { AdminPayoutRequest, PayoutRequestStatus } from '@/types'
import { formatDateTime, formatYen } from '@/utils/format'
import { pageCount } from '@/utils/pagination'
import { BANK_ACCOUNT_TYPE_LABELS, PAYOUT_REQUEST_STATUS_LABELS } from '@/utils/payout'

const PER_PAGE = 20
// バックエンドの models/payout.py の PAYOUT_NOTE_MAX_LENGTH と揃える
const NOTE_MAX_LENGTH = 1000

type Filter = PayoutRequestStatus | 'all'

const FILTER_OPTIONS: ToggleOption<Filter>[] = [
  { value: 'requested', label: '振込待ち' },
  { value: 'paid', label: '振込済み' },
  { value: 'rejected', label: '取り下げ' },
  { value: 'all', label: 'すべて' },
]

type Action = { id: number; kind: 'paid' | 'reject' }

// 運営(admin)が、主催者からの振込の申請を確認し、銀行で振り込んだ結果を記録する画面
export function AdminPayoutRequestsPage() {
  const [filter, setFilter] = useState<Filter>('requested')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApiResource(
    `admin-payout-requests:${filter}:${page}`,
    (signal) => getAdminPayoutRequests(filter === 'all' ? null : filter, page, PER_PAGE, signal),
    '振込の申請を取得できませんでした',
  )
  const action = useAsyncAction<Action>()
  // 失敗の文を操作した行に出すため、最後に操作した申請を覚えておく
  const [lastActionId, setLastActionId] = useState<number | null>(null)
  // 理由を書かずに「取り下げる」を押した申請
  const [reasonMissingId, setReasonMissingId] = useState<number | null>(null)
  // 処理した行は一覧から消えて押したボタンもなくなるので、見出しへフォーカスを戻す
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [announcement, setAnnouncement] = useState('')
  const requests = data?.items ?? []
  const totalPages = pageCount(data?.total, PER_PAGE)
  // 処理して件数が減り、今のページがなくなったら最後のページへ移る
  if (data && page > totalPages) setPage(totalPages)

  function changeFilter(next: Filter) {
    setFilter(next)
    setPage(1)
  }

  async function process(request: AdminPayoutRequest, kind: Action['kind']) {
    const message =
      kind === 'paid'
        ? `${request.facilitator_name}さんへの${formatYen(request.transfer_amount)}を振込済みにします。銀行での振込は済みましたか?この操作は取り消せません。`
        : `${request.facilitator_name}さんの申請を取り下げます。申請額${formatYen(request.amount)}は主催者の申請できる額に戻ります。この操作は取り消せません。`
    const note = (notes[request.id] ?? '').trim()
    setLastActionId(request.id)
    // 取り下げは、主催者が直して申請し直せるよう理由を必須にする(バックエンドも 422 で断る)
    if (kind === 'reject' && !note) {
      setReasonMissingId(request.id)
      document.getElementById(`payout-note-${request.id}`)?.focus()
      return
    }
    setReasonMissingId(null)
    if (!confirm(message)) return
    const result = await action.run(
      () => (kind === 'paid' ? markPayoutPaid(request.id, note) : rejectPayout(request.id, note)),
      '申請を処理できませんでした',
      { id: request.id, kind },
    )
    if (!result.ok) return
    setAnnouncement(
      `${request.facilitator_name}さんの申請を${kind === 'paid' ? '振込済み' : '取り下げ'}にしました。`,
    )
    headingRef.current?.focus()
    reload()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/me">マイページに戻る</BackLink>
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-fg focus:outline-none">
        振込の申請
      </h1>
      <p className="mt-1 text-sm text-fg-muted">
        主催者からの振込の申請です。銀行で振込を済ませてから「振込済みにする」を押してください。メモは主催者にも表示されます。
      </p>
      <ToggleGroup
        label="表示する申請"
        hideLabel
        options={FILTER_OPTIONS}
        value={filter}
        onChange={changeFilter}
        className="mt-4"
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {loading && !data && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={error} className="mt-6" />
      {data && requests.length === 0 && <p className="mt-6 text-fg-muted">該当する申請はありません。</p>}
      <ul className="mt-6 space-y-4">
        {requests.map((r) => {
          const noteId = `payout-note-${r.id}`
          const busy = action.pendingKey?.id === r.id
          return (
            <PaperCard as="li" key={r.id} cornerFold={false} className="p-5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {r.facilitator_name}
                  <span className="ml-2 text-xs font-normal text-fg-muted">{r.facilitator_email}</span>
                </p>
                <span className="font-medium">{PAYOUT_REQUEST_STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
              <p className="mt-1 text-xs text-fg-muted">{formatDateTime(r.requested_at)} に申請</p>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <dt className="text-fg-muted">振込額</dt>
                <dd className="font-semibold">
                  {formatYen(r.transfer_amount)}
                  <span className="ml-2 text-xs font-normal text-fg-muted">
                    (申請額 {formatYen(r.amount)} − 振込手数料 {formatYen(r.transfer_fee)})
                  </span>
                </dd>
                <dt className="text-fg-muted">金融機関</dt>
                <dd>
                  {r.bank_account.bank_name}(金融機関コード {r.bank_account.bank_code})
                </dd>
                <dt className="text-fg-muted">支店</dt>
                <dd>
                  {r.bank_account.branch_name}(支店コード {r.bank_account.branch_code})
                </dd>
                <dt className="text-fg-muted">口座</dt>
                <dd>
                  {BANK_ACCOUNT_TYPE_LABELS[r.bank_account.account_type] ?? r.bank_account.account_type}{' '}
                  {r.bank_account.account_number}
                </dd>
                <dt className="text-fg-muted">口座名義</dt>
                <dd>{r.bank_account.account_holder}</dd>
                {r.processed_at && (
                  <>
                    <dt className="text-fg-muted">処理日時</dt>
                    <dd>{formatDateTime(r.processed_at)}</dd>
                  </>
                )}
                {r.note && (
                  <>
                    <dt className="text-fg-muted">メモ</dt>
                    <dd className="whitespace-pre-wrap">{r.note}</dd>
                  </>
                )}
              </dl>
              {r.status === 'requested' && (
                <div className="mt-4 space-y-3 border-t border-border-muted pt-4">
                  <div>
                    <label htmlFor={noteId} className="block text-xs font-medium text-fg-secondary">
                      メモ(振込日など。取り下げるときは理由を必ず書いてください)
                    </label>
                    <textarea
                      id={noteId}
                      rows={2}
                      maxLength={NOTE_MAX_LENGTH}
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      disabled={busy}
                      aria-invalid={reasonMissingId === r.id ? true : undefined}
                      aria-describedby={reasonMissingId === r.id ? `${noteId}-error` : undefined}
                      className={INPUT_CLASS}
                    />
                    {reasonMissingId === r.id && (
                      <p id={`${noteId}-error`} className="mt-1 text-xs text-red-300">
                        取り下げる理由を入力してください。主催者に表示されます。
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => process(r, 'paid')}
                      disabled={action.pending}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      {busy && action.pendingKey?.kind === 'paid' ? '記録しています...' : '振込済みにする'}
                    </button>
                    <button
                      type="button"
                      onClick={() => process(r, 'reject')}
                      disabled={action.pending}
                      className={DANGER_SMALL_BUTTON_CLASS}
                    >
                      {busy && action.pendingKey?.kind === 'reject' ? '取り下げています...' : '取り下げる'}
                    </button>
                  </div>
                  {lastActionId === r.id && <ErrorMessage message={action.error} />}
                </div>
              )}
            </PaperCard>
          )
        })}
      </ul>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
    </div>
  )
}
