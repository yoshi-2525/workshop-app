import { useId, type ChangeEvent, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { LocationTypeBadge } from '@/components/workshop/LocationTypeBadge'
import { WorkshopDateTime } from '@/components/workshop/WorkshopDateTime'
import { NumberInput } from '@/components/ui/NumberInput'
import { PaperCard } from '@/components/ui/PaperCard'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { LABEL_CLASS } from '@/components/ui/styles'
import type { Workshop, WorkshopInput } from '@/types'
import { formatPriceYen } from '@/utils/format'
import { UPLOAD_IMAGE_ACCEPT } from '@/utils/image'
import { googleMapsSearchUrl } from '@/utils/maps'
import {
  WORKSHOP_CAPACITY_MAX,
  WORKSHOP_DESCRIPTION_MAX_LENGTH,
  WORKSHOP_TITLE_MAX_LENGTH,
} from '@/utils/workshop'

const FIELD_CLASS = 'rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none'
const INPUT_CLASS = `w-full ${FIELD_CLASS}`

interface PublishedWorkshopFormFieldsProps {
  form: WorkshopInput
  setForm: Dispatch<SetStateAction<WorkshopInput>>
  // 保存済みのワークショップ。変更できない「予約の条件」はここから表示する
  workshop: Workshop
  // 画像の選択・削除の状態はページ側で持ち、保存時にアップロード・削除する
  imageInputRef: RefObject<HTMLInputElement | null>
  imagePreviewUrl: string | null
  currentImageUrl: string
  removeImage: boolean
  onImageChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  // 予約済みのチケット枚数。定員はこれより少なくできない
  reservedCount: number
  // カードの最後に置く内容(保存・中止のボタン)
  footer?: ReactNode
}

// 「予約の条件」の1項目。値が空なら「未設定」と出す
function ConditionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-[13px] text-fg-muted">{label}</dt>
      <dd className="whitespace-pre-line break-words text-[15px] leading-relaxed text-fg">
        {children || <span className="text-fg-muted">未設定</span>}
      </dd>
    </div>
  )
}

// 公開中のワークショップの編集フォーム。
// 変更できる項目(タイトル・説明・画像・定員)だけを入力欄にし、参加者が予約したときの条件(開催形式・場所・日時・
// 参加費・支払方法・参加者への案内)は入力欄ではなく文字で見せる(触れそうで触れない無効の入力欄を並べないため)。
// 新規作成・下書きの編集は WorkshopFormFields を使う
export function PublishedWorkshopFormFields({
  form,
  setForm,
  workshop,
  imageInputRef,
  imagePreviewUrl,
  currentImageUrl,
  removeImage,
  onImageChange,
  onRemoveImage,
  reservedCount,
  footer,
}: PublishedWorkshopFormFieldsProps) {
  const titleId = useId()
  const descriptionId = useId()
  const imageId = useId()
  const imageHelpId = useId()
  const capacityId = useId()
  const capacityHelpId = useId()
  const conditionsHeadingId = useId()
  const minCapacity = Math.max(1, reservedCount)

  function setField<K extends keyof WorkshopInput>(key: K, value: WorkshopInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const imageUrl = imagePreviewUrl ?? (removeImage ? '' : currentImageUrl)
  const isOffline = workshop.location_type === 'offline'
  const mapUrl = isOffline && workshop.location.trim() ? googleMapsSearchUrl(workshop.location.trim()) : null
  const paymentLabel =
    workshop.price > 0 ? (workshop.payment_method === 'online' ? 'オンライン決済(カード)' : '当日払い') : null

  return (
    <PaperCard className="p-6 pb-12">
      <h2 className="text-base font-semibold text-fg">内容</h2>
      <div className="mt-4 space-y-5">
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
          <span className={LABEL_CLASS}>画像</span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={imagePreviewUrl ? 'プレビュー' : '現在の画像'}
                className="aspect-video w-40 rounded-md border border-border object-cover"
              />
            ) : (
              <span className="flex aspect-video w-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-fg-muted">
                画像なし
              </span>
            )}
            <div className="flex flex-col items-start gap-1.5">
              {/* ファイル選択の欄は見えなくし、ラベルをボタンの見た目にする(キーボードでは欄そのものにフォーカスが当たる) */}
              <input
                id={imageId}
                ref={imageInputRef}
                type="file"
                accept={UPLOAD_IMAGE_ACCEPT}
                onChange={onImageChange}
                aria-describedby={imageHelpId}
                className="peer sr-only"
              />
              <label
                htmlFor={imageId}
                className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-fg hover:bg-surface-strong peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
              >
                {imageUrl ? '画像を変更' : '画像を選ぶ'}
              </label>
              {imageUrl && (
                <button type="button" onClick={onRemoveImage} className="text-[13px] text-fg-muted underline hover:text-fg">
                  {imagePreviewUrl ? '画像を取り消す' : '画像を削除する'}
                </button>
              )}
            </div>
          </div>
          <p id={imageHelpId} className="mt-2 text-xs text-fg-muted">
            16:9で表示されます(推奨サイズ: 1280×720 / jpg, png, webp, gif / 5MBまで)。
          </p>
        </div>
        <div className="max-w-xs">
          <label htmlFor={capacityId} className={LABEL_CLASS}>
            定員(最大{WORKSHOP_CAPACITY_MAX}名)
            <RequiredMark />
          </label>
          <div className="mt-1 flex items-center gap-2">
            <NumberInput
              id={capacityId}
              min={minCapacity}
              max={WORKSHOP_CAPACITY_MAX}
              required
              value={form.capacity}
              onValueChange={(capacity) => setField('capacity', capacity)}
              aria-describedby={reservedCount > 0 ? capacityHelpId : undefined}
              className={`w-28 ${FIELD_CLASS}`}
            />
            <span className="shrink-0 text-sm text-fg-secondary">名</span>
          </div>
          {reservedCount > 0 && (
            <p id={capacityHelpId} className="mt-1 text-xs text-fg-muted">
              現在の参加人数は{reservedCount}名です。{minCapacity}名以上にしてください。
            </p>
          )}
        </div>
      </div>

      {/* 予約の条件は、入力欄ではなく文字で見せる */}
      <section aria-labelledby={conditionsHeadingId} className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id={conditionsHeadingId} className="text-base font-semibold text-fg">
            予約の条件
          </h2>
          <span className="text-xs text-fg-muted">公開後は変更できません</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          参加者はこの条件で予約しています。伝え忘れたことは「参加者全員へのお知らせ」から送れます。
        </p>
        {/* 項目はワークショップ詳細の日時・場所の欄と同じ白い枠にまとめる */}
        <dl className="mt-3 space-y-2 rounded-lg bg-surface/70 p-4">
          <ConditionRow label="開催">
            {/* 開催形式はワークショップ詳細と同じバッジで見せる */}
            <LocationTypeBadge type={workshop.location_type} className="mr-1.5" />
            {workshop.location}
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 whitespace-nowrap text-[13px] underline underline-offset-[3px] hover:text-fg-secondary"
              >
                地図で確認
              </a>
            )}
          </ConditionRow>
          <ConditionRow label="開催日時">
            <WorkshopDateTime start={workshop.start_at} end={workshop.end_at} />
          </ConditionRow>
          <ConditionRow label="参加費">
            {formatPriceYen(workshop.price)}
            {paymentLabel && ` ・ ${paymentLabel}`}
          </ConditionRow>
          <ConditionRow label="当日のご案内">{workshop.participant_info?.guide ?? ''}</ConditionRow>
          <ConditionRow label="緊急連絡先">{workshop.participant_info?.emergency_contact ?? ''}</ConditionRow>
        </dl>
      </section>

      {footer}
    </PaperCard>
  )
}
