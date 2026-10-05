import { useId, useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { getPayoutAccount } from '@/api/payouts'
import { useApiResource } from '@/hooks/useApiResource'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import type { PaymentMethod, WorkshopInput } from '@/types'
import { ONLINE_PAYMENT_MIN_PRICE, PAYOUT_SETTINGS_PATH } from '@/utils/payment'
import { UPLOAD_IMAGE_ACCEPT } from '@/utils/image'
import { googleMapsSearchUrl } from '@/utils/maps'
import {
  LOCATION_TYPE_OPTIONS,
  WORKSHOP_CANCELLATION_POLICY_MAX_LENGTH,
  WORKSHOP_CAPACITY_MAX,
  WORKSHOP_DESCRIPTION_MAX_LENGTH,
  WORKSHOP_EMERGENCY_CONTACT_MAX_LENGTH,
  WORKSHOP_LOCATION_MAX_LENGTH,
  WORKSHOP_PARTICIPANT_GUIDE_MAX_LENGTH,
  WORKSHOP_PRICE_MAX,
  WORKSHOP_TITLE_MAX_LENGTH,
} from '@/utils/workshop'
import { PaperCard } from '@/components/ui/PaperCard'
import { FILE_INPUT_CLASS } from '@/components/ui/styles'
import { ErrorMessage } from '@/components/ui/StatusMessage'

const INPUT_CLASS =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted'
const LABEL_CLASS = 'block text-sm font-medium text-fg-secondary'

interface WorkshopFormFieldsProps {
  form: WorkshopInput
  setForm: Dispatch<SetStateAction<WorkshopInput>>
  // 画像の選択・削除の状態はページ側で持ち、保存時にアップロード・削除する
  imageInputRef: RefObject<HTMLInputElement | null>
  imagePreviewUrl: string | null
  currentImageUrl: string
  removeImage: boolean
  onImageChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  // 公開中のワークショップの編集。参加者が予約したときの条件(参加費・支払方法・日時・場所)は変更できない
  lockConditions?: boolean
  // 予約済みのチケット枚数。定員はこれより少なくできない
  reservedCount?: number
}

// 有料のワークショップの参加費の支払方法。オンライン決済は、主催者の受け取り設定が済んでいるときだけ選べる
function PaymentMethodField({
  value,
  price,
  onChange,
  disabled,
  describedBy,
}: {
  value: PaymentMethod
  price: number
  onChange: (value: PaymentMethod) => void
  disabled: boolean
  describedBy?: string
}) {
  const { data: payout, error: payoutError } = useApiResource(
    'payout-account',
    getPayoutAccount,
    '受け取り設定を確認できなかったため、オンライン決済を選べません。時間をおいて開き直してください',
  )
  const name = useId()
  const onlineHelpId = useId()
  const canChooseOnline = payout?.online_payment_available === true && payout.status === 'enabled'
  const options: { value: PaymentMethod; label: string; description: string; enabled: boolean }[] = [
    {
      value: 'onsite',
      label: '当日払い',
      description: '開催当日に会場で、参加者から直接お受け取りください。',
      enabled: true,
    },
    {
      value: 'online',
      label: 'オンライン決済(カード)',
      description:
        '予約時に参加者がカードで支払い、決済手数料と本サービスの手数料を差し引いてご登録の口座に入金されます。',
      // 選択済みのもの(受け取り設定の前に下書きで選んだもの)は、選び直せるよう有効のままにする
      enabled: canChooseOnline || value === 'online',
    },
  ]

  return (
    <fieldset aria-describedby={describedBy}>
      <legend className={LABEL_CLASS}>参加費の支払方法</legend>
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm text-fg">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled || !option.enabled}
              aria-describedby={option.value === 'online' && payout && !canChooseOnline ? onlineHelpId : undefined}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>
              {option.label}
              <span className="block text-xs text-fg-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {payout && !canChooseOnline && (
        <p id={onlineHelpId} className="mt-2 text-xs text-fg-muted">
          {payout.online_payment_available ? (
            <>
              オンライン決済を選ぶには、
              <Link to={PAYOUT_SETTINGS_PATH} className="underline">
                参加費の受け取り設定
              </Link>
              を済ませてください。
            </>
          ) : (
            '現在、オンライン決済はご利用いただけません。'
          )}
        </p>
      )}
      <ErrorMessage message={payoutError} className="mt-2 text-xs" />
      {/* Stripe は最低決済額より安い支払いを受け付けないので、保存する前に伝える(保存時はバックエンドが 422 で断る) */}
      {value === 'online' && price < ONLINE_PAYMENT_MIN_PRICE && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          オンライン決済の参加費は{ONLINE_PAYMENT_MIN_PRICE}円以上にしてください。
        </p>
      )}
    </fieldset>
  )
}

// ワークショップ作成・編集フォームの入力欄一式。一覧・詳細と同じ紙のカードとして表示する
// (右下の角の折れが最後の入力欄にかからないよう、下の余白を広めに取る)
export function WorkshopFormFields({
  form,
  setForm,
  imageInputRef,
  imagePreviewUrl,
  currentImageUrl,
  removeImage,
  onImageChange,
  onRemoveImage,
  lockConditions = false,
  reservedCount = 0,
}: WorkshopFormFieldsProps) {
  // 開始日時は時刻まで入力しないと form.start_at に入らないので、選んだ開始日だけを別に持っておく
  const [pickedStartDate, setPickedStartDate] = useState('')
  const startDate = form.start_at ? form.start_at.slice(0, 10) : pickedStartDate

  const titleId = useId()
  const descriptionId = useId()
  const imageId = useId()
  const imageHelpId = useId()
  const locationId = useId()
  const locationHelpId = useId()
  const capacityId = useId()
  const priceId = useId()
  const policyId = useId()
  const policyHelpId = useId()
  const capacityHelpId = useId()
  const lockedHelpId = useId()
  const guideId = useId()
  const emergencyContactId = useId()
  const participantInfoHelpId = useId()
  const minCapacity = Math.max(1, reservedCount)

  // 入力欄の変更は、直前の値をもとに1項目だけ書き換える
  function setField<K extends keyof WorkshopInput>(key: K, value: WorkshopInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const mapUrl = form.location.trim() ? googleMapsSearchUrl(form.location.trim()) : null

  return (
    <PaperCard className="space-y-4 p-6 pb-12">
      <div>
        <label htmlFor={titleId} className={LABEL_CLASS}>
          タイトル
          <RequiredMark />
        </label>
        <input
          id={titleId}
          required
          maxLength={WORKSHOP_TITLE_MAX_LENGTH}
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          className={`mt-1 ${INPUT_CLASS}`}
        />
        <p className="mt-1 text-right text-xs text-fg-muted">
          {form.title.length} / {WORKSHOP_TITLE_MAX_LENGTH}文字
        </p>
      </div>
      <div>
        <label htmlFor={descriptionId} className={LABEL_CLASS}>
          説明
          <RequiredMark />
        </label>
        <textarea
          id={descriptionId}
          required
          rows={6}
          maxLength={WORKSHOP_DESCRIPTION_MAX_LENGTH}
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`mt-1 ${INPUT_CLASS}`}
        />
        <p className="mt-1 text-right text-xs text-fg-muted">
          {form.description.length} / {WORKSHOP_DESCRIPTION_MAX_LENGTH}文字
        </p>
      </div>
      <div>
        <label htmlFor={imageId} className={LABEL_CLASS}>
          画像
        </label>
        <input
          id={imageId}
          ref={imageInputRef}
          type="file"
          accept={UPLOAD_IMAGE_ACCEPT}
          onChange={onImageChange}
          aria-describedby={imageHelpId}
          className={`mt-1 ${FILE_INPUT_CLASS}`}
        />
        <p id={imageHelpId} className="mt-1 text-xs text-fg-muted">
          一覧・詳細ページに16:9で表示される画像をアップロードしてください(推奨サイズ: 1280×720 / jpg, png, webp, gif / 5MBまで)。比率が異なる画像は中央を基準に切り抜いて表示されます。
        </p>
        {imagePreviewUrl ? (
          <div className="mt-2">
            <img
              src={imagePreviewUrl}
              alt="プレビュー"
              className="aspect-video w-full max-w-md rounded-md border border-border-muted object-cover"
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="mt-2 text-xs text-red-300 underline"
            >
              画像を取り消す
            </button>
          </div>
        ) : currentImageUrl && !removeImage ? (
          <div className="mt-2">
            <img
              src={currentImageUrl}
              alt="現在の画像"
              className="aspect-video w-full max-w-md rounded-md border border-border-muted object-cover"
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="mt-2 text-xs text-red-300 underline"
            >
              画像を削除する
            </button>
          </div>
        ) : null}
      </div>

      {lockConditions && (
        <p id={lockedHelpId} className="rounded-md bg-surface/70 p-3 text-xs text-fg-secondary">
          公開中のワークショップは開催場所・開催日時・参加費・支払方法を変更できません。
          開催の条件を変える場合は、中止してから新しく作成してください。
        </p>
      )}

      <ToggleGroup
        label="開催形式"
        options={LOCATION_TYPE_OPTIONS}
        value={form.location_type}
        onChange={(locationType) => setField('location_type', locationType)}
        disabled={lockConditions}
      />

      {form.location_type === 'offline' ? (
        <div>
          <label htmlFor={locationId} className={LABEL_CLASS}>
            会場名・住所
            <RequiredMark />
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={locationId}
              required
              maxLength={WORKSHOP_LOCATION_MAX_LENGTH}
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="例: 東京都渋谷区神宮前4丁目 表参道カフェスペース"
              disabled={lockConditions}
              aria-describedby={lockConditions ? `${locationHelpId} ${lockedHelpId}` : locationHelpId}
              className={INPUT_CLASS}
            />
            <a
              href={mapUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!mapUrl}
              className={`shrink-0 whitespace-nowrap rounded-md bg-surface px-3 py-2 text-sm text-fg-secondary shadow-sm hover:bg-white ${
                mapUrl ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              地図で確認
            </a>
          </div>
          <p id={locationHelpId} className="mt-1 text-xs text-fg-muted">
            「地図で確認」から地図アプリで住所や周辺情報を確認できます。
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor={locationId} className={LABEL_CLASS}>
            オンライン開催ツール・URL
            <RequiredMark />
          </label>
          <input
            id={locationId}
            required
            maxLength={WORKSHOP_LOCATION_MAX_LENGTH}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="例: Zoom(お申し込み後にURLをご案内します)"
            disabled={lockConditions}
            aria-describedby={lockConditions ? lockedHelpId : undefined}
            className={`mt-1 ${INPUT_CLASS}`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateTimeField
          label="開始日時"
          required
          value={form.start_at}
          onChange={(start_at) => setField('start_at', start_at)}
          onDateChange={setPickedStartDate}
          disabled={lockConditions}
        />
        <DateTimeField
          label="終了日時"
          required
          value={form.end_at}
          onChange={(end_at) => setField('end_at', end_at)}
          // 開始日を選ぶと終了日にも同じ日付を入れ、開始日より前は選べないようにする
          followDate={startDate || undefined}
          minDate={startDate || undefined}
          disabled={lockConditions}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={capacityId} className={LABEL_CLASS}>
            定員(最大{WORKSHOP_CAPACITY_MAX}名)
            <RequiredMark />
          </label>
          <input
            id={capacityId}
            type="number"
            min={minCapacity}
            max={WORKSHOP_CAPACITY_MAX}
            required
            value={form.capacity}
            onChange={(e) => setField('capacity', Number(e.target.value))}
            aria-describedby={reservedCount > 0 ? capacityHelpId : undefined}
            className={`mt-1 ${INPUT_CLASS}`}
          />
          {reservedCount > 0 && (
            <p id={capacityHelpId} className="mt-1 text-xs text-fg-muted">
              現在の参加人数は{reservedCount}名です。定員は{minCapacity}名以上にしてください。
            </p>
          )}
        </div>
        <div>
          <label htmlFor={priceId} className={LABEL_CLASS}>
            参加費(円、最大{WORKSHOP_PRICE_MAX.toLocaleString()}円)
            <RequiredMark />
          </label>
          <input
            id={priceId}
            type="number"
            min={0}
            max={WORKSHOP_PRICE_MAX}
            step={100}
            required
            disabled={lockConditions}
            aria-describedby={lockConditions ? lockedHelpId : undefined}
            value={form.price}
            onChange={(e) => {
              const price = Number(e.target.value)
              // 無料にしたら、キャンセルポリシーと支払方法は使わないので戻す
              setForm((prev) => ({
                ...prev,
                price,
                cancellation_policy: price > 0 ? prev.cancellation_policy : '',
                payment_method: price > 0 ? prev.payment_method : 'onsite',
              }))
            }}
            className={`mt-1 ${INPUT_CLASS}`}
            placeholder="0円の場合は無料として表示されます"
          />
        </div>
      </div>

      {form.price > 0 && (
        <PaymentMethodField
          value={form.payment_method}
          price={form.price}
          onChange={(value) => setField('payment_method', value)}
          disabled={lockConditions}
          describedBy={lockConditions ? lockedHelpId : undefined}
        />
      )}

      {form.price > 0 && (
        <div>
          <label htmlFor={policyId} className={LABEL_CLASS}>
            キャンセルポリシー
          </label>
          <textarea
            id={policyId}
            rows={3}
            maxLength={WORKSHOP_CANCELLATION_POLICY_MAX_LENGTH}
            value={form.cancellation_policy}
            onChange={(e) => setField('cancellation_policy', e.target.value)}
            placeholder="例: 開催3日前までは無料キャンセル可能です。それ以降は参加費の50%をキャンセル料として申し受けます。"
            aria-describedby={policyHelpId}
            className={`mt-1 ${INPUT_CLASS}`}
          />
          <p id={policyHelpId} className="mt-1 text-xs text-fg-muted">
            有料ワークショップの参加者には、この内容がワークショップ詳細ページに表示されます。
          </p>
        </div>
      )}

      <fieldset className="space-y-4 border-t border-border-muted pt-4">
        <legend className="sr-only">参加者への案内</legend>
        <p id={participantInfoHelpId} className="rounded-md bg-surface/70 p-3 text-xs text-fg-secondary">
          以下の2項目は、予約した参加者だけに表示されます(一般には公開されません)。
          開催の約1日前に、この内容が主催者からのメッセージとして予約した参加者全員へ自動で送信されます。
        </p>
        <div>
          <label htmlFor={guideId} className={LABEL_CLASS}>
            当日のご案内
          </label>
          <textarea
            id={guideId}
            rows={5}
            maxLength={WORKSHOP_PARTICIPANT_GUIDE_MAX_LENGTH}
            value={form.participant_guide}
            onChange={(e) => setField('participant_guide', e.target.value)}
            placeholder={
              '例: 開始10分前に会場2階の受付へお越しください。\n持ち物: 筆記用具、汚れてもよい服装\nオンライン参加URL: https://...'
            }
            aria-describedby={participantInfoHelpId}
            className={`mt-1 ${INPUT_CLASS}`}
          />
          <p className="mt-1 text-right text-xs text-fg-muted">
            {form.participant_guide.length} / {WORKSHOP_PARTICIPANT_GUIDE_MAX_LENGTH}文字
          </p>
        </div>
        <div>
          <label htmlFor={emergencyContactId} className={LABEL_CLASS}>
            緊急連絡先
          </label>
          <input
            id={emergencyContactId}
            maxLength={WORKSHOP_EMERGENCY_CONTACT_MAX_LENGTH}
            value={form.emergency_contact}
            onChange={(e) => setField('emergency_contact', e.target.value)}
            placeholder="例: 090-1234-5678(当日の遅刻・欠席のご連絡はこちらへ)"
            aria-describedby={participantInfoHelpId}
            className={`mt-1 ${INPUT_CLASS}`}
          />
        </div>
      </fieldset>
    </PaperCard>
  )
}
