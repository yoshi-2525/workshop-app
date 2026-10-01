import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { listWorkshopsPage } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import type { Workshop } from '../types'
import { toApiParams, type WorkshopListState } from '../utils/workshopListState'

interface UseWorkshopListPageOptions {
  perPage: number
  // 閲覧中に件数が減って、現在のページが最終ページより後ろになったときに呼ぶ(最終ページへ移すなど)
  onPageOutOfRange: (lastPage: number) => void
}

/** 検索条件(listState)に一致する公開ワークショップを1ページ分取得する。条件が変わるたびに取り直す */
export function useWorkshopListPage(listState: WorkshopListState, { perPage, onPageOutOfRange }: UseWorkshopListPageOptions) {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 呼び出し側で毎回作り直される関数なので、取得のきっかけにはせず、最新のものを ref から呼ぶ
  const onPageOutOfRangeRef = useRef(onPageOutOfRange)
  useEffect(() => {
    onPageOutOfRangeRef.current = onPageOutOfRange
  })

  useEffect(() => {
    const controller = new AbortController()
    const { page } = listState

    setLoading(true)
    setError(null)
    listWorkshopsPage({ ...toApiParams(listState), page, perPage }, controller.signal)
      .then(({ items, total }) => {
        const lastPage = Math.max(1, Math.ceil(total / perPage))
        if (page > lastPage) {
          // 読み込み中のまま、呼び出し側がページを移すのを待つ(移した先でもう一度取得する)
          onPageOutOfRangeRef.current(lastPage)
          return
        }
        setWorkshops(items)
        setTotal(total)
        setLoading(false)
      })
      .catch((err) => {
        // 次の検索で中断された古いリクエストは無視する
        if (axios.isCancel(err)) return
        setError(extractErrorMessage(err, 'ワークショップの取得に失敗しました'))
        setLoading(false)
      })

    return () => controller.abort()
  }, [listState, perPage])

  return { workshops, total, loading, error }
}
