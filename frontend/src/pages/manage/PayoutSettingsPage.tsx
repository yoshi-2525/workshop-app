import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getBankAccount, getEarnings, getPayoutRequests, getPayoutSummary, requestPayout } from '@/api/payouts'
import { BackLink } from '@/components/ui/BackLink'
import { Pagination } from '@/components/ui/Pagination'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { BankAccount, PayoutSummary } from '@/types'
import { formatDateTime, formatYen } from '@/utils/format'
import { pageCount } from '@/utils/pagination'
import { FACILITATOR_SHARE_PERCENT } from '@/utils/payment'
import { PAYOUT_REQUEST_STATUS_LABELS, earningStatusLabel, formatBankAccount } from '@/utils/payout'
import { BankAccountForm } from './BankAccountForm'

const REQUESTS_PER_PAGE = 5
const EARNINGS_PER_PAGE = 10

// 振込を申請できない理由。申請できるなら null(最終的な判定はバックエンドが行う)。
// hasBankAccount が null なのは、口座を取得できず登録の有無がわからないとき
function requestBlocker(summary: PayoutSummary, hasBankAccount: boolean | null): string | null {
  if (hasBankAccount === null) return '振込先の口座を確認できないため、いまは申請できません。時間をおいて開き直してください。'
  if (summary.can_request) return null
  if (!hasBankAccount) return '振込を申請するには、下の「振込先の口座」を登録してください。'
  if (summary.requested_amount > 0) return '申請中の振込があります。振込が済むと、次の申請ができます。'
  return `申請できる額が${formatYen(summary.min_amount)}以上になると、振込を申請できます。`
}

export function PayoutSettingsPage() {
  const summary = useApiResource('payout-summary', getPayoutSummary, '売上の取得に失敗しました')
  const bank = useApiResource('payout-bank-account', getBankAccount, '振込先の口座の取得に失敗しました')
  // 申請すると履歴の1ページ目に加わるので、履歴を取り直すきっかけにする
  const [requestVersion, setRequestVersion] = useState(0)

  function handleBankSaved(account: BankAccount) {
    bank.setData(account)
    summary.reload()
  }

  function handleRequested() {
    summary.reload()
    setRequestVersion((v) => v + 1)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/me">マイページに戻る</BackLink>
      <h1 className="text-xl font-semibold text-fg">売上と振込</h1>
      <p className="mt-1 text-sm text-fg-muted">
        オンライン決済の参加費は本サービスがお預かりし、参加費の{FACILITATOR_SHARE_PERCENT}%を主催者の売上として記録します。ワークショップの開催を終えた分から、ご登録の口座への振込を申請できます。
        詳しくは
        <Link to="/help/facilitator-guidelines" className="underline">
          主催者ガイドライン
        </Link>
        をご覧ください。
      </p>

      {summary.loading && !summary.data && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={summary.error} className="mt-6" />
      {/* 口座を取得できなくても売上は見られるよう、口座の有無がわからない間は申請だけを止める */}
      {summary.data && (
        <SummaryCard
          summary={summary.data}
          hasBankAccount={bank.data === undefined ? null : bank.data !== null}
          onRequested={handleRequested}
        />
      )}

      <PaperCard as="section" cornerFold={false} className="mt-6 p-6" aria-labelledby="bank-account-heading">
        <h2 id="bank-account-heading" className="font-semibold">
          振込先の口座
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          申請中の振込は、申請したときの口座へ振り込みます。口座を変更した場合は、次の申請から変更後の口座へ振り込みます。
        </p>
        {bank.loading && bank.data === undefined && <LoadingMessage className="mt-4" />}
        <ErrorMessage message={bank.error} className="mt-4" />
        {bank.data !== undefined && (
          <div className="mt-4">
            <BankAccountForm initial={bank.data} onSaved={handleBankSaved} />
          </div>
        )}
      </PaperCard>

      <PayoutRequestHistory version={requestVersion} />
      <EarningsList />
    </div>
  )
}

function SummaryCard({
  summary,
  hasBankAccount,
  onRequested,
}: {
  summary: PayoutSummary
  hasBankAccount: boolean | null
  onRequested: () => void
}) {
  const request = useAsyncAction()
  const [done, setDone] = useState<string | null>(null)
  const blocker = requestBlocker(summary, hasBankAccount)
  const transferAmount = summary.available_amount - summary.transfer_fee

  async function handleRequest() {
    if (
      !confirm(
        `${formatYen(summary.available_amount)}の振込を申請します。振込手数料${formatYen(summary.transfer_fee)}を差し引いた${formatYen(transferAmount)}を、ご登録の口座へ振り込みます。よろしいですか?`,
      )
    ) {
      return
    }
    setDone(null)
    const result = await request.run(requestPayout, '振込を申請できませんでした')
    if (!result.ok) return
    setDone(`${formatYen(result.value.transfer_amount)}の振込を申請しました。振込が済むまで、しばらくお待ちください。`)
    onRequested()
  }

  const rows: { label: string; amount: number; note: string }[] = [
    { label: '開催前', amount: summary.upcoming_amount, note: '開催を終えると、申請できる額に加わります' },
    { label: '振込待ち', amount: summary.requested_amount, note: '申請済みで、振込を待っている額' },
    { label: '振込済み', amount: summary.paid_amount, note: 'これまでに振り込んだ額(振込手数料を含む)' },
  ]

  return (
    <PaperCard as="section" cornerFold={false} className="mt-6 p-6" aria-labelledby="payout-summary-heading">
      <h2 id="payout-summary-heading" className="text-sm text-fg-muted">
        振込を申請できる額
      </h2>
      <p className="mt-1 text-3xl font-semibold">{formatYen(summary.available_amount)}</p>
      {!summary.online_payment_available && (
        <p className="mt-2 text-sm">
          現在、オンライン決済の受け付けを停止しています。これまでの売上の振込は申請できます。
        </p>
      )}
      <dl className="mt-4 grid gap-3 border-t border-border-muted pt-4 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-fg-muted">{row.label}</dt>
            <dd className="font-medium">{formatYen(row.amount)}</dd>
            <dd className="text-xs text-fg-muted">{row.note}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 border-t border-border-muted pt-4">
        <button
          type="button"
          onClick={handleRequest}
          // 申請の後、売上を取り直すまでの間に、もう一度押されないようにする
          disabled={blocker !== null || request.pending || done !== null}
          aria-describedby="payout-request-help"
          className={PRIMARY_BUTTON_CLASS}
        >
          {request.pending ? '申請しています...' : '振込を申請する'}
        </button>
        <p id="payout-request-help" className="mt-2 text-xs text-fg-muted">
          {blocker === null
            ? `申請できる額の全額を申請します。振込手数料${formatYen(summary.transfer_fee)}を差し引いた${formatYen(transferAmount)}を振り込みます。`
            : `${blocker}振込手数料は1回${formatYen(summary.transfer_fee)}で、申請額から差し引きます。`}
        </p>
        {/* 読み上げられるよう、ライブリージョンは置いたまま中身だけ入れ替える */}
        <p role="status" className="mt-2 text-sm empty:hidden">
          {done}
        </p>
        <ErrorMessage message={request.error} className="mt-2 text-sm" />
      </div>
    </PaperCard>
  )
}

function PayoutRequestHistory({ version }: { version: number }) {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useApiResource(
    `payout-requests:${page}:${version}`,
    (signal) => getPayoutRequests(page, REQUESTS_PER_PAGE, signal),
    '振込の申請の履歴を取得できませんでした',
  )
  const requests = data?.items ?? []
  const totalPages = pageCount(data?.total, REQUESTS_PER_PAGE)

  return (
    <PaperCard as="section" cornerFold={false} className="mt-6 p-6" aria-labelledby="payout-history-heading">
      <h2 id="payout-history-heading" className="font-semibold">
        振込の申請の履歴
      </h2>
      {loading && !data && <LoadingMessage className="mt-4" />}
      <ErrorMessage message={error} className="mt-4" />
      {data && requests.length === 0 && <p className="mt-4 text-sm text-fg-muted">まだ振込の申請はありません。</p>}
      {requests.length > 0 && (
        <ul className="mt-4 divide-y divide-border-muted">
          {requests.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>{formatDateTime(r.requested_at)} に申請</span>
                <span className="font-medium">{PAYOUT_REQUEST_STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
              <p className="mt-1 text-fg-secondary">
                申請額 {formatYen(r.amount)} − 振込手数料 {formatYen(r.transfer_fee)} = 振込額 {formatYen(r.transfer_amount)}
              </p>
              <p className="mt-1 text-xs text-fg-muted">振込先: {formatBankAccount(r.bank_account)}</p>
              {r.processed_at && (
                <p className="mt-1 text-xs text-fg-muted">
                  {r.status === 'paid' ? '振込' : '取り下げ'}: {formatDateTime(r.processed_at)}
                </p>
              )}
              {r.note && <p className="mt-1 text-xs text-fg-muted">運営からのメモ: {r.note}</p>}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} label="振込の申請の履歴のページ送り" />
    </PaperCard>
  )
}

function EarningsList() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useApiResource(
    `payout-earnings:${page}`,
    (signal) => getEarnings(page, EARNINGS_PER_PAGE, signal),
    '売上の明細を取得できませんでした',
  )
  const earnings = data?.items ?? []
  const totalPages = pageCount(data?.total, EARNINGS_PER_PAGE)

  return (
    <PaperCard as="section" cornerFold={false} className="mt-6 p-6" aria-labelledby="earnings-heading">
      <h2 id="earnings-heading" className="font-semibold">
        売上の明細
      </h2>
      <p className="mt-1 text-xs text-fg-muted">
        オンライン決済で支払われた参加費ごとの売上です。キャンセルや中止で返金になったものは、売上になりません。
      </p>
      {loading && !data && <LoadingMessage className="mt-4" />}
      <ErrorMessage message={error} className="mt-4" />
      {data && earnings.length === 0 && (
        <p className="mt-4 text-sm text-fg-muted">まだオンライン決済の売上はありません。</p>
      )}
      {earnings.length > 0 && (
        <ul className="mt-4 divide-y divide-border-muted">
          {earnings.map((e) => (
            <li key={e.payment_id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <Link to={`/manage/workshops/${e.workshop_id}/reservations`} className="underline">
                  {e.workshop_title}
                </Link>
                <p className="text-xs text-fg-muted">
                  {formatDateTime(e.workshop_end_at)} 終了 / {e.user_name}さん / 参加費 {formatYen(e.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatYen(e.facilitator_amount)}</p>
                <p className="text-xs text-fg-muted">{earningStatusLabel(e)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} label="売上の明細のページ送り" />
    </PaperCard>
  )
}
