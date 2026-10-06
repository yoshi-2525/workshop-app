// 一覧の総ページ数。件数が 0 でも 1 ページとして扱う(ページ送りの表示と、範囲外のページの補正に使う)
export function pageCount(total: number | undefined, perPage: number): number {
  return Math.max(1, Math.ceil((total ?? 0) / perPage))
}
