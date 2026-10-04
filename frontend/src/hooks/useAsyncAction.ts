import { useCallback, useState } from 'react'
import { extractErrorMessage } from '@/api/client'

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: unknown }

/**
 * ボタンなどから API を呼ぶ操作の「実行中」と「失敗したときのメッセージ」を扱う。
 *
 * - run(action, errorMessage, key): 前のエラーを消し、実行中にしてから action を呼ぶ。
 *   失敗したら API のメッセージ(なければ errorMessage)を error に入れる。例外は投げず、結果を返す
 * - key: 一覧の行ごとの操作など、どれを実行中かを区別したいときに渡す(pendingKey に入る)
 */
export function useAsyncAction<Key = true>() {
  const [pendingKey, setPendingKey] = useState<Key | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async <T>(action: () => Promise<T>, errorMessage: string, key?: Key): Promise<ActionResult<T>> => {
      setError(null)
      setPendingKey(key ?? (true as Key))
      try {
        return { ok: true, value: await action() }
      } catch (err) {
        setError(extractErrorMessage(err, errorMessage))
        return { ok: false, error: err }
      } finally {
        setPendingKey(null)
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return { run, pending: pendingKey !== null, pendingKey, error, clearError }
}
