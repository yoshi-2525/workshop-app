import { useId, useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import type { WorkshopInput } from '@/types'
import { googleMapsSearchUrl } from '@/utils/maps'
import {
  LOCATION_TYPE_OPTIONS,
  WORKSHOP_CANCELLATION_POLICY_MAX_LENGTH,
  WORKSHOP_CAPACITY_MAX,
  WORKSHOP_DESCRIPTION_MAX_LENGTH,
  WORKSHOP_IMAGE_TYPES,
  WORKSHOP_LOCATION_MAX_LENGTH,
  WORKSHOP_PRICE_MAX,
  WORKSHOP_TITLE_MAX_LENGTH,
} from '@/utils/workshop'

const INPUT_CLASS =
  'w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none'
const LABEL_CLASS = 'block text-sm font-medium text-slate-700'

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
}

// ワークショップ作成・編集フォームの入力欄一式。枠線付きのカードとして表示する
export function WorkshopFormFields({
  form,
  setForm,
  imageInputRef,
  imagePreviewUrl,
  currentImageUrl,
  removeImage,
  onImageChange,
  onRemoveImage,
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

  // 入力欄の変更は、直前の値をもとに1項目だけ書き換える
  function setField<K extends keyof WorkshopInput>(key: K, value: WorkshopInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const mapUrl = form.location.trim() ? googleMapsSearchUrl(form.location.trim()) : null

  return (
    <div className="space-y-4 rounded-lg border border-border-muted bg-white p-6 shadow-sm">
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
        <p className="mt-1 text-right text-xs text-slate-500">
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
        <p className="mt-1 text-right text-xs text-slate-500">
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
          accept={WORKSHOP_IMAGE_TYPES.join(',')}
          onChange={onImageChange}
          aria-describedby={imageHelpId}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover"
        />
        <p id={imageHelpId} className="mt-1 text-xs text-slate-500">
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
              className="mt-2 text-xs text-red-600 underline"
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
              className="mt-2 text-xs text-red-600 underline"
            >
              画像を削除する
            </button>
          </div>
        ) : null}
      </div>

      <ToggleGroup
        label="開催形式"
        options={LOCATION_TYPE_OPTIONS}
        value={form.location_type}
        onChange={(locationType) => setField('location_type', locationType)}
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
              aria-describedby={locationHelpId}
              className={INPUT_CLASS}
            />
            <a
              href={mapUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!mapUrl}
              className={`shrink-0 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 ${
                mapUrl ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              地図で確認
            </a>
          </div>
          <p id={locationHelpId} className="mt-1 text-xs text-slate-500">
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
        />
        <DateTimeField
          label="終了日時"
          required
          value={form.end_at}
          onChange={(end_at) => setField('end_at', end_at)}
          // 開始日を選ぶと終了日にも同じ日付を入れ、開始日より前は選べないようにする
          followDate={startDate || undefined}
          minDate={startDate || undefined}
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
            min={1}
            max={WORKSHOP_CAPACITY_MAX}
            required
            value={form.capacity}
            onChange={(e) => setField('capacity', Number(e.target.value))}
            className={`mt-1 ${INPUT_CLASS}`}
          />
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
            value={form.price}
            onChange={(e) => {
              const price = Number(e.target.value)
              setForm((prev) => ({
                ...prev,
                price,
                cancellation_policy: price > 0 ? prev.cancellation_policy : '',
              }))
            }}
            className={`mt-1 ${INPUT_CLASS}`}
            placeholder="0円の場合は無料として表示されます"
          />
        </div>
      </div>

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
          <p id={policyHelpId} className="mt-1 text-xs text-slate-500">
            有料ワークショップの参加者には、この内容がワークショップ詳細ページに表示されます。
          </p>
        </div>
      )}
    </div>
  )
}
