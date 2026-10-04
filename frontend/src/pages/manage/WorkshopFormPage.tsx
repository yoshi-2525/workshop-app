import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createWorkshop,
  deleteWorkshopImage,
  getWorkshop,
  updateWorkshop,
  uploadWorkshopImage,
} from '@/api/workshops'
import { extractErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import type { Workshop, WorkshopInput, WorkshopStatus } from '@/types'
import { toDateTimeInputValue } from '@/utils/date'
import { parseIdParam } from '@/utils/params'
import { validateUploadImage } from '@/utils/image'
import { isWorkshopFinished } from '@/utils/workshop'
import { WorkshopFormFields } from '@/pages/manage/WorkshopFormFields'
import { removeWorkshopDraft, useWorkshopDraft, workshopDraftKey } from '@/pages/manage/useWorkshopDraft'

// 公開中のワークショップで変更できない項目(参加者が予約したときの条件)。バックエンドの check_workshop_input と揃える
const LOCKED_WHEN_PUBLISHED = ['price', 'start_at', 'end_at', 'location_type', 'location'] as const

const emptyForm: WorkshopInput = {
  title: '',
  description: '',
  location_type: 'offline',
  location: '',
  start_at: '',
  end_at: '',
  capacity: 10,
  price: 0,
  cancellation_policy: '',
  participant_guide: '',
  emergency_contact: '',
  status: 'draft',
}

export function WorkshopFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const workshopId = parseIdParam(id)
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<WorkshopInput>(emptyForm)
  const [initialForm, setInitialForm] = useState<WorkshopInput>(emptyForm)
  const [loading, setLoading] = useState(isEdit)
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 入力内容をこのブラウザに自動保存する。編集画面では、読み込みが終わってから始める
  const draftKey =
    user && !loading && !finished && !(isEdit && workshopId === null)
      ? workshopDraftKey(user.id, isEdit ? workshopId : null)
      : null
  const { pendingDraft, lastSavedAt, takePendingDraft, discardPendingDraft, clearDraft } =
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

  useEffect(() => {
    if (!isEdit) return
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }
    getWorkshop(workshopId)
      .then((workshop) => {
        if (workshop.status === 'canceled') {
          setNotEditableMessage('中止したワークショップは編集できません。')
          return
        }
        if (isWorkshopFinished(workshop)) {
          setNotEditableMessage('開催済みのワークショップは編集できません。')
          return
        }
        const loaded: WorkshopInput = {
          title: workshop.title,
          description: workshop.description,
          location_type: workshop.location_type,
          location: workshop.location,
          start_at: toDateTimeInputValue(new Date(workshop.start_at)),
          end_at: toDateTimeInputValue(new Date(workshop.end_at)),
          capacity: workshop.capacity,
          price: workshop.price,
          cancellation_policy: workshop.cancellation_policy,
          participant_guide: workshop.participant_info?.guide ?? '',
          emergency_contact: workshop.participant_info?.emergency_contact ?? '',
          status: workshop.status,
        }
        setForm(loaded)
        setInitialForm(loaded)
        setCurrentImageUrl(workshop.image_url)
        setSavedWorkshop(workshop)
      })
      .catch((err) => setError(extractErrorMessage(err, '取得に失敗しました')))
      .finally(() => setLoading(false))
  }, [isEdit, workshopId])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    const invalidMessage = validateUploadImage(file)
    if (invalidMessage) {
      setError(invalidMessage)
      e.target.value = ''
      return
    }
    setError(null)
    setImageFile(file)
    setRemoveImage(false)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setRemoveImage(true)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // 読み込んだ内容(新規なら空のフォーム)から変更があるか。画像の選択・削除も変更に含める
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(imageFile) || removeImage

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
      (isDirty ? '\n(編集中の内容は保存されません)' : '')
    if (!confirm(message)) return
    setError(null)
    setCanceling(true)
    try {
      await updateWorkshop(savedWorkshop.id, {
        title: savedWorkshop.title,
        description: savedWorkshop.description,
        location_type: savedWorkshop.location_type,
        location: savedWorkshop.location,
        start_at: savedWorkshop.start_at,
        end_at: savedWorkshop.end_at,
        capacity: savedWorkshop.capacity,
        price: savedWorkshop.price,
        cancellation_policy: savedWorkshop.cancellation_policy,
        participant_guide: savedWorkshop.participant_info?.guide ?? '',
        emergency_contact: savedWorkshop.participant_info?.emergency_contact ?? '',
        status: 'canceled',
      })
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
      for (const key of LOCKED_WHEN_PUBLISHED) Object.assign(payload, { [key]: savedWorkshop[key] })
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
      if (imageFile) {
        await uploadWorkshopImage(workshop.id, imageFile)
      } else if (removeImage) {
        await deleteWorkshopImage(workshop.id)
      }
    } catch (err) {
      setError(
        `ワークショップの内容は保存しましたが、画像の${imageFile ? 'アップロード' : '削除'}に失敗しました。` +
          `もう一度保存してください(${extractErrorMessage(err, '原因不明のエラー')})`,
      )
      setSaving(false)
      return
    }
    clearDraft()
    setSaving(false)
    navigate('/manage')
  }

  if (loading) return <p className="text-fg-muted">読み込み中...</p>
  // 不正な ID のまま保存すると新規作成扱いになるため、フォームを出さない
  if (isEdit && workshopId === null) return <p className="text-red-300">{error}</p>
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-fg">
        {isEdit ? 'ワークショップを編集' : 'ワークショップを新規作成'}
      </h1>
      {pendingDraft && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"
        >
          <p>
            {new Date(pendingDraft.savedAt).toLocaleString('ja-JP', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
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
        <WorkshopFormFields
          form={form}
          setForm={setForm}
          imageInputRef={imageInputRef}
          imagePreviewUrl={imagePreviewUrl}
          currentImageUrl={currentImageUrl}
          removeImage={removeImage}
          onImageChange={handleImageChange}
          onRemoveImage={handleRemoveImage}
          lockConditions={lockConditions}
          reservedCount={reservedCount}
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}
        <p className="mt-3 text-right text-xs text-fg-muted" aria-live="polite">
          {lastSavedAt
            ? `入力内容をこのブラウザに自動保存しました(${new Date(lastSavedAt).toLocaleTimeString('ja-JP', { timeStyle: 'short' })})`
            : '入力内容はこのブラウザに自動保存されます'}
        </p>
        {/* 入力欄のカードとボタンの間は広めに空ける */}
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleCancelClick}
            className="rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-muted"
          >
            キャンセル
          </button>
          {/* 下書き保存は新規作成と下書きの編集のときだけ。公開済みのものは API でも下書きに戻せない */}
          {(!savedWorkshop || savedWorkshop.status === 'draft') && (
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-muted disabled:opacity-50"
            >
              {saving ? '保存中...' : '下書きとして保存'}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? '保存中...' : '公開する'}
          </button>
        </div>
      </form>

      {/* 中止は保存とは別の操作なので、フォームのボタンから離して置く。
          下書きは参加者の目に触れておらず予約もないので中止はできない(取りやめるときは一覧から削除する) */}
      {savedWorkshop?.status === 'published' && (
        <section
          aria-labelledby="cancel-workshop-heading"
          className="mt-12 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4"
        >
          <h2 id="cancel-workshop-heading" className="text-sm font-semibold text-amber-200">
            ワークショップの中止
          </h2>
          <p className="mt-1 text-sm text-amber-200">
            開催を取りやめる場合は中止にします。予約済みの参加者には中止のお知らせが自動で届きます。
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleCancelWorkshop}
              disabled={canceling || saving}
              className="rounded-md border border-amber-400/30 bg-surface px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
            >
              {canceling ? '処理中...' : '中止する'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
