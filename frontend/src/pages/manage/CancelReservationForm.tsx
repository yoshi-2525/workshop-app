import { useEffect, useId, useRef, useState } from 'react'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import type { CancelReason, Reservation } from '@/types'
import { formatYen } from '@/utils/format'
import { FULL_REFUND_FEE_NOTE, refundAmountFor } from '@/utils/payment'
import { DANGER_SMALL_BUTTON_CLASS } from '@/components/ui/styles'

const REASON_OPTIONS: { value: CancelReason; label: string; description: string }[] = [
  {
    value: 'facilitator',
    label: '主催者の都合',
    description: `参加者が支払った参加費を全額返金します。${FULL_REFUND_FEE_NOTE}`,
  },
  {
    value: 'participant',
    label: '参加者からの申し出',
    description:
      '決済手数料と本サービスの手数料を差し引いて返金します。参加者から取消の申し出があった場合だけ選んでください。',
  },
]

interface CancelReservationFormProps {
  // 開いたボタンの aria-controls から参照する
  id: string
  reservation: Reservation
  pending: boolean
  error: string | null
  onConfirm: (reason: CancelReason) => void
  onClose: () => void
}

// 主催者が参加をキャンセルするときのフォーム。理由を選ぶと、オンライン決済の返金額と差し引く手数料を事前に見せる
export function CancelReservationForm({ id, reservation, pending, error, onConfirm, onClose }: CancelReservationFormProps) {
  const [reason, setReason] = useState<CancelReason | null>(null)
  const name = useId()
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // 開いたらフォームの見出しへフォーカスを移し、何を確認しているかを伝える
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const paid = reservation.payment?.status === 'paid' ? reservation.payment : null
  const preview = paid && reason ? refundAmountFor(paid, reason) : null

  return (
    <section id={id} aria-labelledby={headingId} className="mt-3 space-y-3 rounded-md bg-surface/70 p-3">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="font-medium text-fg focus:outline-none">
        {reservation.user_name}さんの参加をキャンセルします
      </h2>
      <fieldset>
        <legend className="text-fg-secondary">キャンセルの理由</legend>
        <div className="mt-2 space-y-2">
          {REASON_OPTIONS.map((option) => (
            <div key={option.value}>
              <label className="flex items-start gap-2 text-fg">
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  disabled={pending}
                  aria-describedby={paid ? `${id}-${option.value}-description` : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
                {option.label}
              </label>
              {/* 当日払いなら返金はないので、返金の説明は支払い済みのときだけ出す */}
              {paid && (
                <p id={`${id}-${option.value}-description`} className="ml-6 text-xs text-fg-muted">
                  {option.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {paid ? (
        <p aria-live="polite" className="text-fg">
          {preview === null
            ? '理由を選ぶと、返金額が表示されます。'
            : preview.stripeFee + preview.serviceFee > 0
              ? `返金額 ${formatYen(preview.refund)}(決済手数料 ${formatYen(preview.stripeFee)}・本サービスの手数料 ${formatYen(preview.serviceFee)}を差し引きます)`
              : `返金額 ${formatYen(preview.refund)}(全額)`}
        </p>
      ) : (
        <p className="text-fg-muted">オンライン決済の支払いがないため、返金はありません。理由は予約の記録に残ります。</p>
      )}
      <p className="text-xs text-fg-muted">
        {paid ? 'キャンセルすると、参加者に理由と返金額が通知されます。' : 'キャンセルすると、参加者に通知されます。'}
        この参加者は同じワークショップを再予約できなくなります。
      </p>

      <ErrorMessage message={error} className="text-xs" />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-muted disabled:opacity-50"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={() => reason && onConfirm(reason)}
          disabled={pending || reason === null}
          className={DANGER_SMALL_BUTTON_CLASS}
        >
          {pending ? 'キャンセル中...' : 'キャンセルを確定する'}
        </button>
      </div>
    </section>
  )
}
