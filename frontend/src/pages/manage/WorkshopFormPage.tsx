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

// 開催済み・中止のワークショップは編集できない。編集できるなら null
function notEditableReason(workshop: Workshop): string | null {
  if (workshop.status === 'canceled') return '中止したワークショップは編集できません。'
  if (isWorkshopFinished(workshop)) return '開催済みのワークショップは編集できません。'
  return null
}

export function WorkshopFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const workshopId = parseIdParam(id)
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<WorkshopInput>(emptyForm)
  const [initialForm, setInitialForm] = useState<WorkshopInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 開催済み・中止のワークショップは編集できない(URL を直接開いた場合もフォームを出さない)。
  // 編集できない理由のメッセージを入れる
  const [notEditableMessage, setNotEditableMessage] = useState<string | null>(null)
  const finished = notEditableMessage !== null
  // 編集画面で読み込んだ、保存済みのワークショップ(中止の処理に使う)
  const [savedWorkshop, setSavedWorkshop] = useState<Workshop | null>(null)
  const [canceling, setCanceling] = useState(false)
  const { user } = useAuth()
  // 公開中なら参加費・日時・場所は変更できない
  const lockConditions = savedWorkshop?.status === 'published'
  // 定員はこの枚数(参加人数)より少なくできない
  const reservedCount = savedWorkshop?.reserved_count ?? 0

  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const image = useImageSelection(imageInputRef, setError)

  // 編集画面では、保存済みのワークショップを読み込む(ID が不正なら読み込まない)
  const {
    data: loadedWorkshop,
    loading,
    error: loadError,
  } = useApiResource(
    isEdit && workshopId !== null ? `workshop-form:${workshopId}` : null,
    (signal) => getWorkshop(workshopId!, signal),
    '取得に失敗しました',
  )
  // 読み込んだ内容をフォームに反映する(読み込みごとに1回だけ)
  const [appliedWorkshop, setAppliedWorkshop] = useState<Workshop | null>(null)
  if (loadedWorkshop && loadedWorkshop !== appliedWorkshop) {
    setAppliedWorkshop(loadedWorkshop)
    const message = notEditableReason(loadedWorkshop)
    setNotEditableMessage(message)
    if (message === null) {
      const loaded = toWorkshopInput(loadedWorkshop)
      setForm(loaded)
      setInitialForm(loaded)
      setCurrentImageUrl(loadedWorkshop.image_url)
      setSavedWorkshop(loadedWorkshop)
    }
  }

  // 入力内容をこのブラウザに自動保存する。編集画面では、読み込んだ内容をフォームに反映してから始める
  // (反映前に始めると、空のフォームと比べて下書きの有無を判断してしまう)
  const formReady = !isEdit || (loadedWorkshop !== undefined && loadedWorkshop === appliedWorkshop)
  const draftKey =
    user && formReady && !finished ? workshopDraftKey(user.id, isEdit ? workshopId : null) : null
  const { pendingDraft, takePendingDraft, discardPendingDraft, clearDraft } =
    useWorkshopDraft({ storageKey: draftKey, form, baseline: initialForm })

  // 編集できなくなった(開催済み・中止の)ワークショップの下書きは、残しておいても使えないので消す
  useEffect(() => {
    if (finished && user && workshopId !== null) removeWorkshopDraft(workshopDraftKey(user.id, workshopId))
  }, [finished, user, workshopId])

  function handleRestoreDraft() {
    const restored = takePendingDraft()
    if (!restored) return
    // 公開中なら、変更できない項目は下書きの値ではなく今の値のままにする
    setForm((prev) => {
      if (!lockConditions) return restored
      const next = { ...restored }
      for (const key of LOCKED_WHEN_PUBLISHED) Object.assign(next, { [key]: prev[key] })
      return next
    })
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

  async function handleSave(targetStatus: WorkshopStatus) {
    setError(null)

    if (!formRef.current?.reportValidity()) {
      setError('未入力または入力範囲外の項目があります。赤枠の項目を確認してください。')
      return
    }
    // required は空白だけの入力を通すので、必須の文字欄はここで確かめる(バックエンドは前後の空白を除いてから検証する)
    const blankField = BLANK_CHECKED_FIELDS.find(({ key }) => !form[key].trim())
    if (blankField) {
      setError(`${blankField.label}を入力してください。`)
      return
    }

    const startDate = new Date(form.start_at)
    const endDate = new Date(form.end_at)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('開始日時・終了日時を正しく入力してください。')
      return
    }
    if (endDate <= startDate) {
      setError('終了日時は開始日時より後に設定してください。')
      return
    }
    if (form.capacity < reservedCount) {
      setError(`定員は現在の参加人数(${reservedCount}名)以上にしてください。`)
      return
    }

    setSaving(true)
    const payload: WorkshopInput = {
      ...form,
      status: targetStatus,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
    }
    // 公開中なら、変更できない項目は保存済みの値をそのまま送る
    // (フォームの日時は分単位なので、作り直すと秒以下が保存済みの値とずれることがある)
    if (lockConditions && savedWorkshop) {
      // 当日のご案内・緊急連絡先は Workshop では participant_info の中にあるので、入力値の形にそろえてから取り出す。
      // 日時はフォームの分単位の値ではなく、保存済みの値(ISO 形式)をそのまま使う
      const savedValues: WorkshopInput = {
        ...toWorkshopInput(savedWorkshop),
        start_at: savedWorkshop.start_at,
        end_at: savedWorkshop.end_at,
      }
      for (const key of LOCKED_WHEN_PUBLISHED) Object.assign(payload, { [key]: savedValues[key] })
    }
    // 保存済みのものがあれば更新する。新規作成のあと画像の保存だけ失敗した場合も、
    // もう一度保存したときに同じワークショップを二重に作らないよう、作成済みのものを更新する
    const existingId = savedWorkshop?.id ?? (isEdit ? workshopId : null)
    let workshop: Workshop
    try {
      workshop = existingId !== null ? await updateWorkshop(existingId, payload) : await createWorkshop(payload)
    } catch (err) {
      setError(extractErrorMessage(err, '保存に失敗しました'))
      setSaving(false)
      return
    }
    setSavedWorkshop(workshop)

    try {
      if (image.file) {
        await uploadWorkshopImage(workshop.id, image.file)
      } else if (image.removed) {
        await deleteWorkshopImage(workshop.id)
      }
    } catch (err) {
      setError(
        `ワークショップの内容は保存しましたが、画像の${image.file ? 'アップロード' : '削除'}に失敗しました。` +
          `もう一度保存してください(${extractErrorMessage(err, '原因不明のエラー')})`,
      )
      setSaving(false)
      return
    }
    clearDraft()
    setSaving(false)
    navigate('/manage')
  }

  if (loading) return <LoadingMessage />
  // 不正な ID や読み込めなかったまま保存すると新規作成扱いになるため、フォームを出さない
  if (isEdit && workshopId === null) return <ErrorMessage message="ワークショップが見つかりませんでした" />
  if (loadError) return <ErrorMessage message={loadError} />
  if (finished) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-fg-secondary">{notEditableMessage}</p>
        <Link to="/manage" className="mt-4 inline-block text-sm text-fg-secondary underline">
          ワークショップの管理に戻る
        </Link>
      </div>
    )
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
            lockConditions={lockConditions}
            reservedCount={reservedCount}
            isNew={!isEdit}
            footer={footer}
          />
        )}
      </form>
    </div>
  )
}
