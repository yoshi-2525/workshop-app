import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { DEFAULT_DOCUMENT_TITLE, formatDocumentTitle, pageTitleForPath } from '@/utils/pageTitle'

/**
 * 別のページへ移ったことを、画面を見ていない人にも伝える。
 *
 * - <title> をページの名前にする(ブラウザのタブや履歴、読み上げソフトがページを区別できるように)
 * - フォーカスをページの見出し(h1)に移す。まだ読み込み中で見出しがなければ main に移す
 *   (SPA の遷移ではフォーカスが前のページのリンクに残り、ページが変わったことが伝わらないため)
 *
 * どちらも pathname が変わったときだけ行う(一覧の検索条件=クエリだけの変更では動かさない)。
 */
export function RouteChangeHandler({ mainRef }: { mainRef: RefObject<HTMLElement | null> }) {
  const { pathname } = useLocation()

  // ページ側の usePageTitle(useEffect)で上書きできるよう、先に走る useLayoutEffect で設定する
  useLayoutEffect(() => {
    const title = pageTitleForPath(pathname)
    document.title = title ? formatDocumentTitle(title) : DEFAULT_DOCUMENT_TITLE
  }, [pathname])

  // 最初の表示ではフォーカスを動かさない(ブラウザの既定のまま、ページの先頭から読めるように)
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    const main = mainRef.current
    if (!main) return
    const heading = main.querySelector('h1')
    const target = heading ?? main
    // 見出しは本来フォーカスできないので、スクリプトからだけフォーカスできるようにする
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    // スクロール位置は ScrollToTop と一覧の復元に任せる
    target.focus({ preventScroll: true })
  }, [pathname, mainRef])

  return null
}
