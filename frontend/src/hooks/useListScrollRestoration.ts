import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { getListScroll, saveListScroll } from '../utils/workshopListState'

/**
 * 一覧のスクロール位置を一覧の URL ごとに保存し、戻ってきたときに復元する。
 *
 * 「一覧に戻る」(state.restoreScroll)やブラウザの「戻る」で表示したときは、
 * 一覧を読み込み終えて(loading が false になって)から保存した位置へ戻す。
 */
export function useListScrollRestoration(listUrl: string, loading: boolean) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const shouldRestoreScroll =
    navigationType === 'POP' ||
    Boolean((location.state as { restoreScroll?: boolean } | null)?.restoreScroll)

  // 復元(または復元不要の判断)を済ませた表示の location.key。済むまではスクロール位置を保存しない
  // (読み込み中は一覧が短く、ブラウザがスクロール位置を 0 に戻すので、それで保存済みの位置を上書きしないため)
  const settledKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || settledKeyRef.current === location.key) return
    settledKeyRef.current = location.key
    const y = shouldRestoreScroll ? getListScroll(listUrl) : null
    if (y !== null) window.scrollTo(0, y)
    else saveListScroll(listUrl, window.scrollY)
  }, [loading, shouldRestoreScroll, location.key, listUrl])

  // スクロールのたびに書き込まないよう、描画のタイミングにまとめて保存する
  useEffect(() => {
    let frame = 0
    function handleScroll() {
      if (settledKeyRef.current !== location.key) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => saveListScroll(listUrl, window.scrollY))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [listUrl, location.key])
}
