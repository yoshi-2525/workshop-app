import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createWorkshop,
  deleteWorkshopImage,
  getWorkshop,
  updateWorkshop,
  uploadWorkshopImage,
} from '../../api/workshops'
import { extractErrorMessage } from '../../api/client'
import { googleMapsSearchUrl } from '../../utils/maps'
import type { LocationType, WorkshopInput, WorkshopStatus } from '../../types'
import { parseIdParam } from '../../utils/params'

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function toDatetimeLocal(value: string): string {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEdit) return
    if (workshopId === null) {
      setError('ワークショップが見つかりませんでした')
      setLoading(false)
      return
    }
    getWorkshop(workshopId)
      .then((workshop) => {
        const loaded: WorkshopInput = {
          title: workshop.title,
          description: workshop.description,
          location_type: workshop.location_type,
          location: workshop.location,
          start_at: toDatetimeLocal(workshop.start_at),
          end_at: toDatetimeLocal(workshop.end_at),
          capacity: workshop.capacity,
          price: workshop.price,
          cancellation_policy: workshop.cancellation_policy,
          status: workshop.status,
        }
        setForm(loaded)
        setInitialForm(loaded)
        setCurrentImageUrl(workshop.image_url)
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
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('対応していない画像形式です(jpg, png, webp, gif のみ利用できます)')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('画像サイズは5MB以内にしてください。')
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

  function handleCancelClick() {
    const isDirty =
      JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(imageFile) || removeImage
    if (isDirty && !confirm('入力した内容が破棄されますが、よろしいですか?')) {
      return
    }
    navigate('/manage')
  }

  async function handleSave(targetStatus: WorkshopStatus) {
    setError(null)

    if (!formRef.current?.reportValidity()) {
      setError('未入力の項目があります。赤枠の項目を確認してください。')
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

    setSaving(true)
    try {
      const payload: WorkshopInput = {
        ...form,
        status: targetStatus,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
      }
      const workshop =
        isEdit && workshopId !== null ? await updateWorkshop(workshopId, payload) : await createWorkshop(payload)

      if (imageFile) {
        await uploadWorkshopImage(workshop.id, imageFile)
      } else if (removeImage) {
        await deleteWorkshopImage(workshop.id)
      }
      navigate('/manage')
    } catch (err) {
      setError(extractErrorMessage(err, '保存に失敗しました'))
    } finally {
      setSaving(false)
    }
  }

  function setLocationType(locationType: LocationType) {
    setForm((prev) => ({ ...prev, location_type: locationType }))
  }

  if (loading) return <p className="text-slate-500">読み込み中...</p>
  // 不正な ID のまま保存すると新規作成扱いになるため、フォームを出さない
  if (isEdit && workshopId === null) return <p className="text-red-600">{error}</p>

  const mapUrl = form.location.trim() ? googleMapsSearchUrl(form.location.trim()) : null

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">
        {isEdit ? 'ワークショップを編集' : 'ワークショップを新規作成'}
      </h1>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">タイトル</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">説明</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">画像</label>
          <input
            ref={imageInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleImageChange}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
          <p className="mt-1 text-xs text-slate-500">
            一覧・詳細ページに表示される画像をアップロードしてください(jpg, png, webp, gif / 5MBまで)。
          </p>
          {imagePreviewUrl ? (
            <div className="mt-2">
              <img
                src={imagePreviewUrl}
                alt="プレビュー"
                className="h-32 w-full rounded-md border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
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
                className="h-32 w-full rounded-md border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="mt-2 text-xs text-red-600 underline"
              >
                画像を削除する
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">開催形式</label>
          <div className="mt-1 inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setLocationType('offline')}
              className={`rounded px-3 py-1.5 font-medium transition ${
                form.location_type === 'offline'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              オフライン(会場)
            </button>
            <button
              type="button"
              onClick={() => setLocationType('online')}
              className={`rounded px-3 py-1.5 font-medium transition ${
                form.location_type === 'online'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              オンライン
            </button>
          </div>
        </div>

        {form.location_type === 'offline' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700">会場名・住所</label>
            <div className="mt-1 flex gap-2">
              <input
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="例: 東京都渋谷区神宮前4丁目 表参道カフェスペース"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <a
                href={mapUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!mapUrl}
                className={`shrink-0 whitespace-nowrap rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 ${
                  mapUrl ? '' : 'pointer-events-none opacity-50'
                }`}
              >
                地図で確認
              </a>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              「地図で確認」から地図アプリで住所や周辺情報を確認できます。
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700">オンライン開催ツール・URL</label>
            <input
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="例: Zoom(お申し込み後にURLをご案内します)"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">開始日時</label>
            <input
              type="datetime-local"
              required
              value={form.start_at}
              onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">終了日時</label>
            <input
              type="datetime-local"
              required
              value={form.end_at}
              onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">定員</label>
            <input
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">参加費(円)</label>
            <input
              type="number"
              min={0}
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="0円の場合は無料として表示されます"
            />
          </div>
        </div>

        {form.price > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700">キャンセルポリシー</label>
            <textarea
              rows={3}
              value={form.cancellation_policy}
              onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
              placeholder="例: 開催3日前までは無料キャンセル可能です。それ以降は参加費の50%をキャンセル料として申し受けます。"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              有料ワークショップの参加者には、この内容がワークショップ詳細ページに表示されます。
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? '保存中...' : '下書きとして保存'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '公開する'}
          </button>
          <button
            type="button"
            onClick={handleCancelClick}
            className="rounded-md px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
