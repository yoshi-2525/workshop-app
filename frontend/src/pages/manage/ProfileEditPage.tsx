import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateMe } from '../../api/users'
import { extractErrorMessage } from '../../api/client'

export function ProfileEditPage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMe({ name, bio })
      await refreshUser()
      setSaved(true)
    } catch (err) {
      setError(extractErrorMessage(err, '保存に失敗しました'))
    } finally {
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
        <div>
          <label className="block text-sm font-medium text-slate-700">表示名</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">自己紹介</label>
          <textarea
            rows={6}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="経歴や大切にしていること、対話へのスタンスなどを書いてみましょう。"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">保存しました。</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  )
}
