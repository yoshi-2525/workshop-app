import { useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deleteMyAvatar, updateMe, uploadMyAvatar } from '@/api/users'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import {
  AVATAR_IMAGE_MAX_BYTES,
  AVATAR_IMAGE_TYPES,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '@/utils/user'

export function ProfileEditPage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // アイコンは選んだ時点では送らず、「保存する」で表示名・自己紹介と一緒に保存する
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const bioId = useId()
  const avatarId = useId()
  const avatarHelpId = useId()
  // アイコンはワークショップ詳細・主催者ページに出すものなので、主催者と運営だけが設定できる
  const isFacilitator = user?.role === 'admin' || user?.role === 'facilitator'

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!AVATAR_IMAGE_TYPES.includes(file.type)) {
      setError('対応していない画像形式です(jpg, png, webp, gif のみ利用できます)')
      e.target.value = ''
      return
    }
    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
      setError('画像サイズは5MB以内にしてください。')
      e.target.value = ''
      return
    }
    setError(null)
    setAvatarFile(file)
    setRemoveAvatar(false)
    // プレビューは data URL で表示する(後片付けの要らない形にする)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarPreviewUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function clearAvatarSelection() {
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  function handleRemoveAvatar() {
    clearAvatarSelection()
    setRemoveAvatar(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMe({ name, bio })
    } catch (err) {
      setError(extractErrorMessage(err, '保存に失敗しました'))
      setSaving(false)
      return
    }
    try {
      if (avatarFile) {
        await uploadMyAvatar(avatarFile)
      } else if (removeAvatar) {
        await deleteMyAvatar()
      }
      clearAvatarSelection()
      setRemoveAvatar(false)
      setSaved(true)
    } catch (err) {
      setError(
        `表示名と自己紹介は保存しましたが、アイコンの${avatarFile ? 'アップロード' : '削除'}に失敗しました。` +
          extractErrorMessage(err, ''),
      )
    } finally {
      await refreshUser().catch(() => undefined)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">プロフィール編集</h1>
      <p className="mt-1 text-sm text-slate-500">
        {user?.role === 'admin' || user?.role === 'facilitator'
          ? '参加者があなたのワークショップ詳細から見られる公開プロフィールです。'
          : '表示名や自己紹介を編集します。'}
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {isFacilitator && user && (
          <div>
            <label htmlFor={avatarId} className="block text-sm font-medium text-slate-700">
              アイコン
            </label>
            <div className="mt-2 flex items-center gap-4">
              <Avatar
                url={avatarPreviewUrl ?? (removeAvatar ? '' : user.avatar_url)}
                name={name || user.name}
                className="h-16 w-16 text-2xl"
              />
              <div className="min-w-0 flex-1">
                <input
                  id={avatarId}
                  ref={avatarInputRef}
                  type="file"
                  accept={AVATAR_IMAGE_TYPES.join(',')}
                  onChange={handleAvatarChange}
                  aria-describedby={avatarHelpId}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover"
                />
                {avatarFile ? (
                  <button type="button" onClick={clearAvatarSelection} className="mt-2 text-xs text-red-600 underline">
                    選んだ画像を取り消す
                  </button>
                ) : (
                  user.avatar_url &&
                  !removeAvatar && (
                    <button type="button" onClick={handleRemoveAvatar} className="mt-2 text-xs text-red-600 underline">
                      アイコンを削除する
                    </button>
                  )
                )}
              </div>
            </div>
            <p id={avatarHelpId} className="mt-1 text-xs text-slate-500">
              ワークショップ詳細と主催者ページに丸く切り抜いて表示されます(推奨: 正方形 400×400 / jpg, png, webp, gif / 5MBまで)。
            </p>
          </div>
        )}
        <div>
          <label htmlFor={nameId} className="block text-sm font-medium text-slate-700">
            表示名
          </label>
          <input
            id={nameId}
            autoComplete="name"
            required
            maxLength={USER_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={bioId} className="block text-sm font-medium text-slate-700">
            自己紹介
          </label>
          <textarea
            id={bioId}
            rows={6}
            maxLength={USER_BIO_MAX_LENGTH}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="経歴や大切にしていること、対話へのスタンスなどを書いてみましょう。"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {bio.length} / {USER_BIO_MAX_LENGTH}文字
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-emerald-600">
            保存しました。
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  )
}
