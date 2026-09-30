import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// 別のページへ移動したら先頭から表示する。
// ブラウザの「戻る・進む」(POP)と、state.restoreScroll 付きの移動では何もしない
// (ワークショップ一覧が、保存しておいたスクロール位置を自分で復元するため)
export function ScrollToTop() {
  const { pathname, state } = useLocation()
  const navigationType = useNavigationType()
  const restoreScroll = Boolean((state as { restoreScroll?: boolean } | null)?.restoreScroll)

  useEffect(() => {
    // ブラウザ任せの復元は、データの読み込み前に行われて位置がずれるので止める
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previous
    }
  }, [])

  useEffect(() => {
    if (navigationType === 'POP' || restoreScroll) return
    window.scrollTo(0, 0)
    // pathname が変わったときだけ動かす(一覧の検索条件=クエリだけの変更では動かさない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
