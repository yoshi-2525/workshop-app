import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import axios from 'axios'
import { extractErrorMessage } from '@/api/client'

interface ResourceResult<T> {
  // 結果がどの取得のものか。key が変わったら古い結果は表示しない
  key: string
  requestId: number
  data?: T
  error?: string
}

/**
 * API からデータを取得し、読み込み中・エラー・取得結果をまとめて扱う。
 *
 * - key が変わるたびに取り直す(ページの ID など、取得内容を決める値を文字列にして渡す)。
 *   null の間は取得しない(URL の ID が不正なときなど)
 * - key が変わったときや画面を離れたときは、通信中のリクエストを中断する
 * - reload() で同じ key のまま取り直す。取り直している間も、前回の取得結果は data に残る
 * - setData() で取得結果を画面側から書き換えられる(削除・既読などの操作を反映するとき)
 */
export function useApiResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  errorMessage: string,
) {
  const [result, setResult] = useState<ResourceResult<T> | null>(null)
  const [requestId, setRequestId] = useState(0)

  // 呼び出し側で毎回作り直される関数・文字列なので、取得のきっかけにはせず、最新のものを ref から使う
  const fetcherRef = useRef(fetcher)
  const errorMessageRef = useRef(errorMessage)
  useEffect(() => {
    fetcherRef.current = fetcher
    errorMessageRef.current = errorMessage
  })

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    fetcherRef.current(controller.signal)
      .then((data) => setResult({ key, requestId, data }))
      .catch((err) => {
        // key が変わった・画面を離れたことで中断したリクエストは無視する
        if (axios.isCancel(err)) return
        setResult({ key, requestId, error: extractErrorMessage(err, errorMessageRef.current) })
      })
    return () => controller.abort()
  }, [key, requestId])

  const reload = useCallback(() => setRequestId((id) => id + 1), [])

  const setData = useCallback((update: SetStateAction<T>) => {
    setResult((prev) => {
      if (!prev || prev.data === undefined) return prev
      const data = typeof update === 'function' ? (update as (prev: T) => T)(prev.data) : update
      return { ...prev, data }
    })
  }, [])

  const isCurrentKey = key !== null && result?.key === key
  const loading = key !== null && !(isCurrentKey && result.requestId === requestId)
  return {
    data: isCurrentKey ? result.data : undefined,
    // 取り直している間は、前回のエラーは出さない
    error: isCurrentKey && !loading ? (result.error ?? null) : null,
    loading,
    reload,
    setData,
  }
}
