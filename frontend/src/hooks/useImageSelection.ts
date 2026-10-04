import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { validateUploadImage } from '@/utils/image'

/**
 * アップロードする画像(ワークショップ画像・主催者アイコン)の選択を扱う。
 * 選んだ時点では送らず、保存するときに file / removed を見てアップロード・削除する。
 *
 * - inputRef: 画像を選ぶ <input type="file"> の ref。選択を取り消したときに入力欄も空にする
 * - select: <input type="file"> の onChange。形式・大きさが合わなければ onError にメッセージを渡す
 * - clearSelection: 選んだ画像を取り消す(保存済みの画像はそのまま)
 * - remove: 保存済みの画像を削除する指定にする
 * - reset: 保存が済んだあと、選択も削除の指定もなかった状態に戻す
 */
export function useImageSelection(
  inputRef: RefObject<HTMLInputElement | null>,
  onError: (message: string | null) => void,
) {
  const [selected, setSelected] = useState<{ file: File; previewUrl: string } | null>(null)
  const [removed, setRemoved] = useState(false)
  // 画面を離れるときに解放するため、今のプレビューの URL を覚えておく
  const previewUrlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    },
    [],
  )

  function replaceSelection(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const next = file ? { file, previewUrl: URL.createObjectURL(file) } : null
    previewUrlRef.current = next?.previewUrl ?? null
    setSelected(next)
  }

  function select(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    const invalidMessage = validateUploadImage(file)
    if (invalidMessage) {
      onError(invalidMessage)
      e.target.value = ''
      return
    }
    onError(null)
    replaceSelection(file)
    setRemoved(false)
  }

  function clearSelection() {
    replaceSelection(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove() {
    clearSelection()
    setRemoved(true)
  }

  function reset() {
    clearSelection()
    setRemoved(false)
  }

  return {
    file: selected?.file ?? null,
    // 選んだ画像のプレビュー。選んでいなければ null
    previewUrl: selected?.previewUrl ?? null,
    removed,
    select,
    clearSelection,
    remove,
    reset,
  }
}
