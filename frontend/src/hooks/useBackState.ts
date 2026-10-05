import { useLocation } from 'react-router-dom'

// 「← ○○に戻る」リンク(BackLink)の戻り先。リンク元のページがルーターの state に入れて渡す
export interface BackTarget {
  to: string
  // 「○○に戻る」の ○○ の部分
  label: string
}

export interface BackState {
  backTo: BackTarget
}

// location.state から戻り先を取り出す。渡されていない(直接開いた・再読み込みした)ときは null
export function readBackTarget(state: unknown): BackTarget | null {
  if (typeof state !== 'object' || state === null || !('backTo' in state)) return null
  const backTo = (state as { backTo: unknown }).backTo
  if (typeof backTo !== 'object' || backTo === null) return null
  const { to, label } = backTo as Partial<BackTarget>
  return typeof to === 'string' && typeof label === 'string' ? { to, label } : null
}

// 今のページを戻り先にする state。戻るリンクのあるページへのリンクに state={...} で渡す。
// URL のクエリ(絞り込み条件など)も含めて、元の表示のまま戻れるようにする
export function useBackState(label: string): BackState {
  const location = useLocation()
  return { backTo: { to: `${location.pathname}${location.search}`, label } }
}

// 今のページが受け取った戻り先を、そのまま次のページへ引き継ぐ state。
// 規約から別の規約へ移ったときなど、最初に来たページへ戻れるようにする
export function useForwardedBackState(): BackState | undefined {
  const location = useLocation()
  const backTo = readBackTarget(location.state)
  return backTo ? { backTo } : undefined
}
