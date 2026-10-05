import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { followFacilitator, unfollowFacilitator } from '@/api/follows'
import { useAuth } from '@/context/AuthContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { PRIMARY_BUTTON_CLASS, PAPER_SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'
import type { FacilitatorProfile } from '@/types'
import { followButtonMode } from '@/utils/user'

// 失敗したときのメッセージを表示しておく時間
const ERROR_DISPLAY_MS = 4000

interface FollowButtonProps {
  facilitator: Pick<FacilitatorProfile, 'id' | 'name' | 'role'>
  isFollowing: boolean
  onChange?: (isFollowing: boolean) => void
  className?: string
}

// 紙のカード(主催者ページ・フォロー中の一覧)の上に置く前提の配色にしている
export function FollowButton({ facilitator, isFollowing, onChange, className = '' }: FollowButtonProps) {
  const { user } = useAuth()
  const location = useLocation()
  const [following, setFollowing] = useState(isFollowing)
  const { run, pending: submitting, error, clearError } = useAsyncAction()

  // 親が新しい値を渡してきたら(再読み込みなど)、表示もそれに合わせる
  const [prevIsFollowing, setPrevIsFollowing] = useState(isFollowing)
  if (isFollowing !== prevIsFollowing) {
    setPrevIsFollowing(isFollowing)
    setFollowing(isFollowing)
  }

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(clearError, ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [error, clearError])

  const mode = followButtonMode(user, facilitator)
  if (mode === 'hidden') return null

  if (mode === 'login') {
    return (
      <Link
        to="/login/participant"
        state={{ from: location.pathname + location.search }}
        className={`${PAPER_SECONDARY_BUTTON_CLASS} inline-block ${className}`}
      >
        ログインしてフォロー
      </Link>
    )
  }

  async function handleClick() {
    const next = !following
    const result = await run(
      async () => {
        if (next) await followFacilitator(facilitator.id)
        else await unfollowFacilitator(facilitator.id)
      },
      'フォローの更新に失敗しました',
    )
    if (!result.ok) return
    setFollowing(next)
    onChange?.(next)
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        // 状態は aria-pressed で伝え、名前は表示の切り替えに関係なく固定にする
        aria-pressed={following}
        aria-label={`${facilitator.name}さんをフォロー`}
        className={following ? PAPER_SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
      >
        {following ? 'フォロー中' : 'フォローする'}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-max max-w-60 rounded-md border border-red-400/30 bg-surface px-2 py-1 text-xs text-red-300 shadow"
        >
          {error}
        </span>
      )}
    </span>
  )
}
