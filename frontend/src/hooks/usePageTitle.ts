import { useEffect } from 'react'
import { formatDocumentTitle } from '@/utils/pageTitle'

/**
 * 読み込んだ内容(ワークショップ名など)で、ページの <title> を上書きする。
 * title が null・undefined の間は何もしない(ルートごとの名前のまま)。
 *
 * ルートごとの名前は RouteChangeHandler が useLayoutEffect で先に設定するので、
 * こちら(useEffect)が後から上書きする。
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = formatDocumentTitle(title)
  }, [title])
}
