import { useCallback, useEffect, useState } from 'react'
import type { WorkshopInput } from '@/types'
import { readStorage, writeStorage } from '@/utils/storage'

// 入力が止まってから保存するまでの待ち時間
const SAVE_DELAY_MS = 1000
const KEY_PREFIX = 'workshop_form_draft'

export interface WorkshopDraft {
  form: WorkshopInput
  savedAt: string
}

function isSameForm(a: WorkshopInput, b: WorkshopInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// localStorage の値は壊れていたり古い形式だったりする可能性があるので、
// 各項目の型を確かめ、既定値(fallback)と同じ形に整えてから使う
function parseDraft(raw: string | null, fallback: WorkshopInput): WorkshopDraft | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const { form, savedAt } = data as { form?: unknown; savedAt?: unknown }
    if (typeof form !== 'object' || form === null || typeof savedAt !== 'string') return null
    const source = form as Record<string, unknown>
    const merged = { ...fallback } as Record<string, unknown>
    for (const key of Object.keys(fallback) as (keyof WorkshopInput)[]) {
      if (typeof source[key] === typeof fallback[key]) merged[key] = source[key]
    }
    const restored = merged as unknown as WorkshopInput
    if (restored.location_type !== 'online' && restored.location_type !== 'offline') {
      restored.location_type = fallback.location_type
    }
    return { form: restored, savedAt }
  } catch {
    return null
  }
}

export function workshopDraftKey(userId: number, workshopId: number | null): string {
  return `${KEY_PREFIX}:${userId}:${workshopId ?? 'new'}`
}

export function removeWorkshopDraft(key: string) {
  writeStorage('local', key, null)
}

interface UseWorkshopDraftOptions {
  // null の間は何もしない(ユーザー情報や編集対象の読み込み前など)
  storageKey: string | null
  form: WorkshopInput
  // 変更のない状態(新規なら空のフォーム、編集なら読み込んだ内容)。これと同じなら下書きは残さない
  baseline: WorkshopInput
}

// ワークショップ作成・編集フォームの入力内容を、このブラウザに自動保存する
export function useWorkshopDraft({ storageKey, form, baseline }: UseWorkshopDraftOptions) {
  // 画面を開いたときに見つかった下書き。復元するか破棄するか選ぶまで自動保存は止める
  const [pendingDraft, setPendingDraft] = useState<WorkshopDraft | null>(null)
  const [checkedKey, setCheckedKey] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // 保存済みの下書きを探す(キーごとに1回だけ)
  if (storageKey !== null && checkedKey !== storageKey) {
    setCheckedKey(storageKey)
    const draft = parseDraft(readStorage('local', storageKey), baseline)
    setPendingDraft(draft && !isSameForm(draft.form, baseline) ? draft : null)
  }
  const ready = storageKey !== null && checkedKey === storageKey

  useEffect(() => {
    if (!ready || storageKey === null || pendingDraft) return
    const timer = setTimeout(() => {
      if (isSameForm(form, baseline)) {
        writeStorage('local', storageKey, null)
        setLastSavedAt(null)
        return
      }
      const savedAt = new Date().toISOString()
      writeStorage('local', storageKey, JSON.stringify({ form, savedAt } satisfies WorkshopDraft))
      setLastSavedAt(savedAt)
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ready, storageKey, form, baseline, pendingDraft])

  // 復元を選んだとき。呼び出し側でフォームに反映する
  const takePendingDraft = useCallback((): WorkshopInput | null => {
    const draft = pendingDraft
    setPendingDraft(null)
    return draft?.form ?? null
  }, [pendingDraft])

  const discardPendingDraft = useCallback(() => {
    if (storageKey !== null) writeStorage('local', storageKey, null)
    setPendingDraft(null)
  }, [storageKey])

  // 保存に成功したときや、入力を破棄してページを離れるときに呼ぶ
  const clearDraft = useCallback(() => {
    if (storageKey !== null) writeStorage('local', storageKey, null)
    setLastSavedAt(null)
  }, [storageKey])

  return { pendingDraft, lastSavedAt, takePendingDraft, discardPendingDraft, clearDraft }
}
