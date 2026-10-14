import { useCallback, useRef, useState } from 'react'
import { extractErrorMessage } from '@/api/client'

// skipped: 別の操作の実行中だったので、action を呼ばなかった(error は入れるが、error の state には出さない)。
// 失敗したら取り直すなど、action を呼んだときだけ行う処理は skipped を見て分ける
export type ActionResult<T> = { ok: true; value: T } | { ok: false; skipped: boolean; error: unknown }

// Key を指定したときは run に key を必ず渡し、指定しないときは渡さない
type KeyArg<Key> = [Key] extends [never] ? [] : [key: Key]

/**
 * ボタンなどから API を呼ぶ操作の「実行中」と「失敗したときのメッセージ」を扱う。
 *
 * - run(action, errorMessage, key): 前のエラーを消し、実行中にしてから action を呼ぶ。
 *   失敗したら API のメッセージ(なければ errorMessage)を error に入れる。例外は投げず、結果を返す
 * - 実行中に呼ばれた run は action を呼ばず、skipped を返す(再描画でボタンが無効になる前の連打を防ぐ)
 * - key: 一覧の行ごとの操作など、どれを実行中かを区別したいときに Key を指定して渡す(pendingKey に入る)
 */
export function useAsyncAction<Key = never>() {
  const [pending, setPending] = useState(false)
  const [pendingKey, setPendingKey] = useState<Key | null>(null)
  const [error, setError] = useState<string | null>(null)
  // state は次の描画まで変わらないので、実行中かどうかは ref で確かめる
  const runningRef = useRef(false)

  const run = useCallback(
    async <T>(action: () => Promise<T>, errorMessage: string, ...keyArg: KeyArg<Key>): Promise<ActionResult<T>> => {
      if (runningRef.current) return { ok: false, skipped: true, error: new Error('別の操作を実行中です') }
      runningRef.current = true
      setError(null)
      setPending(true)
      setPendingKey(((keyArg as unknown[])[0] as Key | undefined) ?? null)
      try {
        return { ok: true, value: await action() }
      } catch (err) {
        setError(extractErrorMessage(err, errorMessage))
        return { ok: false, skipped: false, error: err }
      } finally {
        runningRef.current = false
        setPending(false)
        setPendingKey(null)
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return { run, pending, pendingKey, error, clearError }
}
