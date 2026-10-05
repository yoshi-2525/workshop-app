import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPayoutAccount, getPayoutDashboardUrl, startPayoutOnboarding } from '@/api/payouts'
import { BackLink } from '@/components/ui/BackLink'
import { PaperCard } from '@/components/ui/PaperCard'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { useApiResource } from '@/hooks/useApiResource'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { PayoutAccountStatus } from '@/types'
import { PAYOUT_LINK_EXPIRED_PARAM } from '@/utils/payment'

type Action = 'onboarding' | 'dashboard'

interface StatusView {
  label: string
  description: string
  // この状態で押せる操作と、そのボタンの文言
  action: Action
  actionLabel: string
}

const STATUS_VIEW: Record<PayoutAccountStatus, StatusView> = {
  not_registered: {
    label: '未設定',
    description: '受け取り設定を済ませると、ワークショップの支払方法に「オンライン決済」を選べるようになります。',
    action: 'onboarding',
    actionLabel: '受け取り設定を始める',
  },
  pending: {
    label: '設定の途中・確認中',
    description:
      '入力が終わっていない項目があるか、Stripe で登録内容を確認しています。確認が済むまで、オンライン決済は選べません。',
    action: 'onboarding',
    actionLabel: '受け取り設定を続ける',
  },
  enabled: {
    label: '受け付けできます',
    description:
      'オンライン決済のワークショップを公開できます。参加費は Stripe からご登録の口座に入金されます。登録内容の変更も Stripe の画面で行えます。',
    action: 'dashboard',
    actionLabel: 'Stripe で売上・入金を確認する',
  },
}

export function PayoutSettingsPage() {
  const [searchParams] = useSearchParams()
  const { data, loading, error: loadError } = useApiResource(
    'payout-account',
    getPayoutAccount,
    '受け取り設定の取得に失敗しました',
  )
  const action = useAsyncAction<Action>()
  // Stripe のページが開くまでの間に、もう一度押されて URL を取り直さないよう、移動を始めたら押せないままにする
  const [redirecting, setRedirecting] = useState<Action | null>(null)
  // Stripe の設定画面の URL は短時間で切れる。切れた状態で開くと、このクエリを付けてここへ戻される
  const linkExpired = searchParams.get(PAYOUT_LINK_EXPIRED_PARAM) === '1'

  // ブラウザの「戻る」でこの画面がそのまま復元されたときは、押せる状態に戻す
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setRedirecting(null)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Stripe の画面の URL は一度しか使えないので、押されてから取得してすぐ移動する
  async function goToStripe(kind: Action) {
    const result = await action.run(
      kind === 'onboarding' ? startPayoutOnboarding : getPayoutDashboardUrl,
      'Stripe の画面を開けませんでした',
      kind,
    )
    if (!result.ok) return
    setRedirecting(kind)
    window.location.assign(result.value)
  }

  // 想定していない状態が返ってきても画面が描けるよう、「設定の途中」として扱う
  const view = data ? (STATUS_VIEW[data.status] ?? STATUS_VIEW.pending) : null
  const busyAction = action.pendingKey ?? redirecting

  return (
    <div className="mx-auto max-w-xl">
      <BackLink to="/me">マイページに戻る</BackLink>
      <h1 className="text-xl font-semibold text-fg">参加費の受け取り設定</h1>
      <p className="mt-1 text-sm text-fg-muted">
        オンライン決済のワークショップの参加費は、決済サービス Stripe を通じて受け取ります。本人確認と入金先の口座の登録は
        Stripe の画面で行います。
      </p>

      {loading && <LoadingMessage className="mt-6" />}
      <ErrorMessage message={loadError} className="mt-6" />

      {data && view && (
        <PaperCard cornerFold={false} className="mt-6 space-y-4 p-6">
          {!data.online_payment_available ? (
            <p className="text-sm">
              現在、オンライン決済はご利用いただけません。有料のワークショップの参加費は、開催当日に会場でお受け取りください。
            </p>
          ) : (
            <>
              {/* Stripe から戻ってきた理由なので、状態より先に読めるようカードの先頭に置く */}
              {linkExpired && data.status !== 'enabled' && (
                <p className="text-sm">
                  設定画面の有効期限が切れました。お手数ですが、もう一度「{view.actionLabel}」からお進みください。
                </p>
              )}
              <div>
                <h2 className="text-sm text-fg-muted">現在の状態</h2>
                <p className="mt-1 font-semibold">{view.label}</p>
                <p className="mt-2 text-sm">{view.description}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => goToStripe(view.action)}
                  disabled={busyAction !== null}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {busyAction === view.action ? '移動しています...' : view.actionLabel}
                </button>
                <ErrorMessage message={action.error} className="mt-2 text-sm" />
              </div>
              <p className="border-t border-border-muted pt-4 text-xs text-fg-muted">
                オンライン決済では、Stripe の決済手数料と本サービスの手数料を参加費から差し引いて入金します。主催者のご都合で予約を取り消したり、ワークショップを中止したりした場合は、参加者へ全額を返金し、決済手数料は戻りません。
              </p>
            </>
          )}
        </PaperCard>
      )}
    </div>
  )
}
