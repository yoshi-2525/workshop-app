import { useEffect, useState } from 'react'
import { addFavorite, removeFavorite } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { HoverLabel } from './HoverLabel'

// 失敗したときのメッセージを表示しておく時間
const ERROR_DISPLAY_MS = 4000

interface FavoriteButtonProps {
  workshopId: number
  isFavorited: boolean
  onChange?: (isFavorited: boolean) => void
  className?: string
}

export function FavoriteButton({ workshopId, isFavorited, onChange, className = '' }: FavoriteButtonProps) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(isFavorited)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 親が新しい値を渡してきたら(一覧の再読み込みなど)、表示もそれに合わせる
  const [prevIsFavorited, setPrevIsFavorited] = useState(isFavorited)
  if (isFavorited !== prevIsFavorited) {
    setPrevIsFavorited(isFavorited)
    setFavorited(isFavorited)
  }

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [error])

  // お気に入りはログインユーザーだけの機能なので、未ログインならボタン自体を出さない
  if (!user) return null

  async function handleClick() {
    setSubmitting(true)
    setError(null)
    const next = !favorited
    try {
      if (next) {
        await addFavorite(workshopId)
      } else {
        await removeFavorite(workshopId)
      }
      setFavorited(next)
      onChange?.(next)
    } catch (err) {
      setError(extractErrorMessage(err, 'お気に入りの更新に失敗しました'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        aria-pressed={favorited}
        aria-label={favorited ? 'お気に入りから外す' : 'お気に入りに追加'}
        className={`peer inline-flex items-center justify-center rounded-full p-2 transition disabled:opacity-50 ${
          favorited ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-red-400'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={favorited ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 20.727c-.288 0-.576-.084-.826-.252C7.29 17.99 3 14.523 3 10.09 3 7.28 5.239 5 8 5c1.54 0 2.97.79 3.83 2.06L12 7.5l.17-.44C13.03 5.79 14.46 5 16 5c2.761 0 5 2.28 5 5.09 0 4.433-4.29 7.9-8.174 10.386-.25.168-.538.252-.826.252Z"
          />
        </svg>
      </button>
      <HoverLabel text="お気に入り" />
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-max max-w-60 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 shadow"
        >
          {error}
        </span>
      )}
    </span>
  )
}
