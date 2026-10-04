import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deleteMyAvatar, updateMe, uploadMyAvatar } from '@/api/users'
import { extractErrorMessage } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { useImageSelection } from '@/hooks/useImageSelection'
import { UPLOAD_IMAGE_ACCEPT } from '@/utils/image'
import { canManageWorkshops, USER_BIO_MAX_LENGTH, USER_NAME_MAX_LENGTH } from '@/utils/user'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { FILE_INPUT_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { PaperCard } from '@/components/ui/PaperCard'

export function ProfileEditPage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // アイコンは選んだ時点では送らず、「保存する」で表示名・自己紹介と一緒に保存する
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatar = useImageSelection(avatarInputRef, setError)
  const nameId = useId()
  const bioId = useId()
  const avatarId = useId()
  const avatarHelpId = useId()
  // アイコンはワークショップ詳細・主催者ページに出すものなので、主催者と運営だけが設定できる
  const isFacilitator = canManageWorkshops(user)

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
      if (avatar.file) {
        await uploadMyAvatar(avatar.file)
      } else if (avatar.removed) {
        await deleteMyAvatar()
      }
      avatar.reset()
      setSaved(true)
    } catch (err) {
      setError(
        `表示名と自己紹介は保存しましたが、アイコンの${avatar.file ? 'アップロード' : '削除'}に失敗しました。` +
          extractErrorMessage(err, ''),
      )
    } finally {
      await refreshUser().catch(() => undefined)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-fg">プロフィール編集</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {isFacilitator
          ? '参加者があなたのワークショップ詳細から見られる公開プロフィールです。'
          : '表示名や自己紹介を編集します。'}
      </p>
      {/* 入力欄一式を、他の一覧・フォームと同じ紙のカードにまとめる */}
      <PaperCard cornerFold={false} className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {isFacilitator && user && (
            <div>
              <label htmlFor={avatarId} className="block text-sm font-medium text-fg-secondary">
                アイコン
              </label>
              <div className="mt-2 flex items-center gap-4">
                <Avatar
                  url={avatar.previewUrl ?? (avatar.removed ? '' : user.avatar_url)}
                  name={name || user.name}
                  className="h-16 w-16 text-2xl"
                />
                <div className="min-w-0 flex-1">
                  <input
                    id={avatarId}
                    ref={avatarInputRef}
                    type="file"
                    accept={UPLOAD_IMAGE_ACCEPT}
                    onChange={avatar.select}
                    aria-describedby={avatarHelpId}
                    className={FILE_INPUT_CLASS}
                  />
                  {avatar.file ? (
                    <button type="button" onClick={avatar.clearSelection} className="mt-2 text-xs text-red-300 underline">
                      選んだ画像を取り消す
                    </button>
                  ) : (
                    user.avatar_url &&
                    !avatar.removed && (
                      <button type="button" onClick={avatar.remove} className="mt-2 text-xs text-red-300 underline">
                        アイコンを削除する
                      </button>
                    )
                  )}
                </div>
              </div>
              <p id={avatarHelpId} className="mt-1 text-xs text-fg-muted">
                ワークショップ詳細と主催者ページに丸く切り抜いて表示されます(推奨: 正方形 400×400 / jpg, png, webp, gif / 5MBまで)。
              </p>
            </div>
          )}
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium text-fg-secondary">
              表示名
            </label>
            <input
              id={nameId}
              autoComplete="name"
              required
              maxLength={USER_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor={bioId} className="block text-sm font-medium text-fg-secondary">
              自己紹介
            </label>
            <textarea
              id={bioId}
              rows={6}
              maxLength={USER_BIO_MAX_LENGTH}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="経歴や大切にしていること、対話へのスタンスなどを書いてみましょう。"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-right text-xs text-fg-muted">
              {bio.length} / {USER_BIO_MAX_LENGTH}文字
            </p>
          </div>
          <ErrorMessage message={error} className="text-sm" />
          {saved && (
            <p role="status" className="text-sm text-emerald-300">
              保存しました。
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={PRIMARY_BUTTON_CLASS}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </PaperCard>
    </div>
  )
}
