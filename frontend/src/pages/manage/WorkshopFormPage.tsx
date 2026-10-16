import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  cancelWorkshop,
  createWorkshop,
  deleteWorkshopImage,
  getWorkshop,
  updateWorkshop,
  uploadWorkshopImage,
} from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { ErrorMessage, LoadingMessage } from '@/components/ui/StatusMessage'
import { useAuth } from '@/context/AuthContext'
import { useApiResource } from '@/hooks/useApiResource'
import { useImageSelection } from '@/hooks/useImageSelection'
import type { Workshop, WorkshopInput, WorkshopStatus } from '@/types'
import { toDateTimeInputValue } from '@/utils/date'
import { formatDateTime } from '@/utils/format'
import { parseIdParam } from '@/utils/params'
import { isWorkshopFinished } from '@/utils/workshop'
import { FULL_REFUND_FEE_NOTE, isOnlinePayment } from '@/utils/payment'
import { WorkshopFormFields } from '@/pages/manage/WorkshopFormFields'
import { PublishedWorkshopFormFields } from '@/pages/manage/PublishedWorkshopFormFields'
import { removeWorkshopDraft, useWorkshopDraft, workshopDraftKey } from '@/pages/manage/useWorkshopDraft'
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

// 公開中のワークショップで変更できない項目(参加者が予約したときの条件)。バックエンドの check_workshop_input と揃える
const LOCKED_WHEN_PUBLISHED = [
  'price',
  'payment_method',
  'start_at',
  'end_at',
  'location_type',
  'location',
  'participant_guide',
  'emergency_contact',
] as const

// 空白だけでは保存できない必須の文字欄(画面の並び順)
const BLANK_CHECKED_FIELDS = [
  { key: 'title', label: 'タイトル' },
  { key: 'description', label: '説明' },
  { key: 'location', label: '場所' },
] as const

const emptyForm: WorkshopInput = {
  title: '',
  description: '',
  location_type: 'offline',
  location: '',
  start_at: '',
  end_at: '',
  capacity: 10,
  price: 0,
  payment_method: 'onsite',
  participant_guide: '',
  emergency_contact: '',
  status: 'draft',
}

// 保存済みのワークショップを、フォームの入力値(日時は端末の時間帯の YYYY-MM-DDTHH:mm)にする
function toWorkshopInput(workshop: Workshop): WorkshopInput {
  return {
    title: workshop.title,
    description: workshop.description,
    location_type: workshop.location_type,
    location: workshop.location,
    start_at: toDateTimeInputValue(new Date(workshop.start_at)),
    end_at: toDateTimeInputValue(new Date(workshop.end_at)),
    capacity: workshop.capacity,
    price: workshop.price,
    payment_method: workshop.payment_method,
    participant_guide: workshop.participant_info?.guide ?? '',
    emergency_contact: workshop.participant_info?.emergency_contact ?? '',
    status: workshop.status,
  }
}

// 公開中で変更できない項目だけ、source の値に置き換える
function preserveLockedFields(form: WorkshopInput, source: WorkshopInput): WorkshopInput {
  const next = { ...form }
  for (const key of LOCKED_WHEN_PUBLISHED) {
    // 項目ごとに型が違い next[key] = source[key] では型が合わないので、ひとつずつ写す
    Object.assign(next, { [key]: source[key] })
  }
  return next
}

// 開催済み・中止のワークショップは編集できない。編集できるなら null
function notEditableReason(workshop: Workshop): string | null {
  if (workshop.status === 'canceled') return '中止したワークショップは編集できません。'
  if (isWorkshopFinished(workshop)) return '開催済みのワークショップは編集できません。'
  return null
}

// 編集画面では保存済みのワークショップを読み込み、編集できるものだけフォームを出す
export function WorkshopFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const workshopId = parseIdParam(id)
  const { user } = useAuth()

  // ID が不正なら読み込まない
  const {
    data: loadedWorkshop,
    loading,
    error: loadError,
  } = useApiResource(
    isEdit && workshopId !== null ? `workshop-form:${workshopId}` : null,
    (signal) => getWorkshop(workshopId!, signal),
    '取得に失敗しました',
  )
  // 開催済み・中止のワークショップは編集できない(URL を直接開いた場合もフォームを出さない)
  const notEditableMessage = loadedWorkshop ? notEditableReason(loadedWorkshop) : null
  const isNotEditable = notEditableMessage !== null

  // 編集できなくなったワークショップの下書きは、残しておいても使えないので消す
  useEffect(() => {
    if (isNotEditable && user && workshopId !== null) removeWorkshopDraft(workshopDraftKey(user.id, workshopId))
  }, [isNotEditable, user, workshopId])

  if (loading) return <LoadingMessage />
  // 不正な ID や読み込めなかったまま保存すると新規作成扱いになるため、フォームを出さない
  if (isEdit && workshopId === null) return <ErrorMessage message="ワークショップが見つかりませんでした" />
  if (loadError) return <ErrorMessage message={loadError} />
  if (isEdit && !loadedWorkshop) return <LoadingMessage />
  if (isNotEditable) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-fg-secondary">{notEditableMessage}</p>
        <Link to="/manage" className="mt-4 inline-block text-sm text-fg-secondary underline">
          ワークショップの管理に戻る
        </Link>
      </div>
    )
  }
  // 読み込んだ内容はフォームの初期値にだけ使う。別のワークショップを開いたら key でフォームを作り直す
  return <WorkshopForm key={workshopId ?? 'new'} workshop={loadedWorkshop ?? null} />
}

interface WorkshopFormProps {
  // 編集するワークショップ。新規作成なら null
  workshop: Workshop | null
}

function WorkshopForm({ workshop }: WorkshopFormProps) {
  const isEdit = workshop !== null
  const navigate = useNavigate()
  const { user } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  // 読み込んだ内容(新規なら空のフォーム)。変更の有無と下書きの要否はこれと比べる
  const [initialForm] = useState<WorkshopInput>(() => (workshop ? toWorkshopInput(workshop) : emptyForm))
  const [form, setForm] = useState<WorkshopInput>(initialForm)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 保存済みのワークショップ。編集画面では読み込んだもので始まり、保存するたびに置き換える
  // (新規作成のあと画像の保存だけ失敗した場合も、もう一度保存したときに二重に作らず更新するため)
  const [savedWorkshop, setSavedWorkshop] = useState<Workshop | null>(workshop)
  // 公開中なら参加費・日時・場所は変更できない
  const lockConditions = savedWorkshop?.status === 'published'
  // 定員はこの枚数(参加人数)より少なくできない
  const reservedCount = savedWorkshop?.reserved_count ?? 0

  const currentImageUrl = workshop?.image_url ?? ''
  const imageInputRef = useRef<HTMLInputElement>(null)
  const image = useImageSelection(imageInputRef, setError)

  // 入力内容をこのブラウザに自動保存する
  const draftKey = user ? workshopDraftKey(user.id, workshop?.id ?? null) : null
  const { pendingDraft, takePendingDraft, discardPendingDraft, clearDraft } =
    useWorkshopDraft({ storageKey: draftKey, form, baseline: initialForm })

  function handleRestoreDraft() {
    const restored = takePendingDraft()
    if (!restored) return
    // 公開中なら、変更できない項目は下書きの値ではなく今の値のままにする
    setForm((prev) => (lockConditions ? preserveLockedFields(restored, prev) : restored))
  }

  // 読み込んだ内容(新規なら空のフォーム)から変更があるか。画像の選択・削除も変更に含める
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(image.file) || image.removed

  function handleCancelClick() {
    if (isDirty && !confirm('入力した内容が破棄されますが、よろしいですか?')) {
      return
    }
    clearDraft()
    navigate('/manage')
  }

  // 保存済みの内容のまま中止にする(フォームで編集中の内容は反映しない)
  async function handleCancelWorkshop() {
    if (!savedWorkshop) return
    const message =
      'このワークショップを中止にしますか?予約済みの参加者には中止のお知らせが自動で届きます。' +
      (isOnlinePayment(savedWorkshop)
        ? `\nオンラインで支払われた参加費は全額を返金します。${FULL_REFUND_FEE_NOTE}`
        : '') +
      (isDirty ? '\n(編集中の内容は保存されません)' : '')
    if (!confirm(message)) return
    setError(null)
    setCanceling(true)
    try {
      await cancelWorkshop(savedWorkshop.id)
      clearDraft()
      navigate('/manage')
    } catch (err) {
      setError(extractErrorMessage(err, '中止処理に失敗しました'))
    } finally {
      setCanceling(false)
    }
  }

  // 保存の前に入力を確かめる。問題があればその内容を返す
  function validateForm(): string | null {
    if (!formRef.current?.reportValidity()) {
      return '未入力または入力範囲外の項目があります。赤枠の項目を確認してください。'
    }
    // required は空白だけの入力を通すので、必須の文字欄はここで確かめる(バックエンドは前後の空白を除いてから検証する)
    const blankField = BLANK_CHECKED_FIELDS.find(({ key }) => !form[key].trim())
    if (blankField) return `${blankField.label}を入力してください。`

    const startDate = new Date(form.start_at)
    const endDate = new Date(form.end_at)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return '開始日時・終了日時を正しく入力してください。'
    }
    if (endDate <= startDate) return '終了日時は開始日時より後に設定してください。'
    if (form.capacity < reservedCount) return `定員は現在の参加人数(${reservedCount}名)以上にしてください。`
    return null
  }

  // 送信する内容を作る(validateForm を通ったあとに呼ぶ)
  function buildPayload(targetStatus: WorkshopStatus): WorkshopInput {
    const payload: WorkshopInput = {
      ...form,
      status: targetStatus,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
    }
    if (!lockConditions || !savedWorkshop) return payload
    // 公開中なら、変更できない項目は保存済みの値をそのまま送る
    // (フォームの日時は分単位なので、作り直すと秒以下が保存済みの値とずれることがある)。
    // 当日のご案内・緊急連絡先は Workshop では participant_info の中にあるので、入力値の形にそろえてから取り出す
    const savedValues: WorkshopInput = {
      ...toWorkshopInput(savedWorkshop),
      start_at: savedWorkshop.start_at,
      end_at: savedWorkshop.end_at,
    }
    return preserveLockedFields(payload, savedValues)
  }

  // 選んだ画像のアップロード、または画像の削除。画像を変えていなければ何もしない
  async function saveImage(workshopId: number) {
    if (image.file) {
      await uploadWorkshopImage(workshopId, image.file)
    } else if (image.removed) {
      await deleteWorkshopImage(workshopId)
    }
  }

  async function handleSave(targetStatus: WorkshopStatus) {
    setError(null)
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload(targetStatus)
      let saved: Workshop
      try {
        saved = savedWorkshop ? await updateWorkshop(savedWorkshop.id, payload) : await createWorkshop(payload)
      } catch (err) {
        setError(extractErrorMessage(err, '保存に失敗しました'))
        return
      }
      setSavedWorkshop(saved)

      try {
        await saveImage(saved.id)
      } catch (err) {
        setError(
          `ワークショップの内容は保存しましたが、画像の${image.file ? 'アップロード' : '削除'}に失敗しました。` +
            `もう一度保存してください(${extractErrorMessage(err, '原因不明のエラー')})`,
        )
        return
      }
      clearDraft()
      navigate('/manage')
    } finally {
      setSaving(false)
    }
  }

  // 保存のボタンは入力欄と同じカードの中、右下に置く(角の折れはカードの下の余白で避ける)
  const footer = (
    <div className="border-t border-border-muted pt-4">
      <ErrorMessage message={error} className="text-sm" />
      <div className="mt-3 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={handleCancelClick} className={GHOST_BUTTON_CLASS}>
          キャンセル
        </button>
        {/* 下書き保存は新規作成と下書きの編集のときだけ。公開済みのものは API でも下書きに戻せない */}
        {(!savedWorkshop || savedWorkshop.status === 'draft') && (
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className={SECONDARY_BUTTON_CLASS}
          >
            {saving ? '保存中...' : '下書きとして保存'}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSave('published')}
          disabled={saving}
          className={PRIMARY_BUTTON_CLASS}
        >
          {saving ? '保存中...' : lockConditions ? '変更を保存する' : '公開する'}
        </button>
      </div>
      {/* 中止は保存とは別の操作なので、カードの一番下に区切って小さく置く。
          下書きは参加者の目に触れておらず予約もないので中止はできない(取りやめるときは一覧から削除する) */}
      {savedWorkshop?.status === 'published' && (
        <section
          aria-labelledby="cancel-workshop-heading"
          className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border-muted pt-3.5"
        >
          <div className="min-w-60 flex-1 text-xs leading-relaxed text-fg-muted">
            <h2 id="cancel-workshop-heading" className="font-semibold text-fg-secondary">
              ワークショップを中止する
            </h2>
            <p>
              {reservedCount > 0 ? `予約済みの${reservedCount}名に中止のお知らせが届き` : '中止すると予約を受け付けなくなり'}
              {isOnlinePayment(savedWorkshop) ? '、オンラインで支払われた参加費は全額返金されます。' : 'ます。'}
              元に戻せません。
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelWorkshop}
            disabled={canceling || saving}
            className="shrink-0 rounded-md border border-red-700/40 px-3 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-700/10 focus-visible:bg-red-700/10 focus-ring focus:outline-hidden disabled:opacity-50"
          >
            {canceling ? '処理中...' : '中止する'}
          </button>
        </section>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-fg">
          {isEdit ? 'ワークショップを編集' : 'ワークショップを新規作成'}
        </h1>
        {lockConditions && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-fg-secondary">公開中</span>
        )}
      </div>
      {pendingDraft && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"
        >
          <p>
            {formatDateTime(pendingDraft.savedAt)}
            に自動保存された入力内容があります。復元しますか?(画像は復元されません)
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="rounded-md bg-amber-700 px-3 py-1.5 font-medium text-white hover:bg-amber-600"
            >
              復元する
            </button>
            <button
              type="button"
              onClick={discardPendingDraft}
              className="rounded-md border border-amber-400/30 px-3 py-1.5 text-amber-200 hover:bg-amber-400/20"
            >
              破棄する
            </button>
          </div>
        </div>
      )}
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="mt-6">
        {lockConditions && savedWorkshop ? (
          // 公開中は、変更できる項目だけを入力欄にしたフォームを使う(予約の条件は文字で見せる)
          <PublishedWorkshopFormFields
            form={form}
            setForm={setForm}
            workshop={savedWorkshop}
            imageInputRef={imageInputRef}
            imagePreviewUrl={image.previewUrl}
            currentImageUrl={currentImageUrl}
            removeImage={image.removed}
            onImageChange={image.select}
            onRemoveImage={image.remove}
            reservedCount={reservedCount}
            footer={footer}
          />
        ) : (
          <WorkshopFormFields
            form={form}
            setForm={setForm}
            imageInputRef={imageInputRef}
            imagePreviewUrl={image.previewUrl}
            currentImageUrl={currentImageUrl}
            removeImage={image.removed}
            onImageChange={image.select}
            onRemoveImage={image.remove}
            reservedCount={reservedCount}
            isNew={!isEdit}
            footer={footer}
          />
        )}
      </form>
    </div>
  )
}
