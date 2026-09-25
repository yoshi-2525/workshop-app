import { useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { addFavorite, removeFavorite } from '../api/workshops'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

interface FavoriteButtonProps {
  workshopId: number
  isFavorited: boolean
  onChange?: (isFavorited: boolean) => void
  className?: string
}

export function FavoriteButton({ workshopId, isFavorited, onChange, className = '' }: FavoriteButtonProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorited, setFavorited] = useState(isFavorited)
  const [submitting, setSubmitting] = useState(false)

  async function handleClick(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      navigate('/login/participant', { state: { from: `/workshops/${workshopId}` } })
      return
    }

    setSubmitting(true)
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
      alert(extractErrorMessage(err, 'お気に入りの更新に失敗しました'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      aria-pressed={favorited}
      aria-label={favorited ? 'お気に入りから外す' : 'お気に入りに追加'}
      className={`inline-flex items-center justify-center rounded-full p-1.5 transition disabled:opacity-50 ${
        favorited ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-red-400'
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 20.727c-.288 0-.576-.084-.826-.252C7.29 17.99 3 14.523 3 10.09 3 7.28 5.239 5 8 5c1.54 0 2.97.79 3.83 2.06L12 7.5l.17-.44C13.03 5.79 14.46 5 16 5c2.761 0 5 2.28 5 5.09 0 4.433-4.29 7.9-8.174 10.386-.25.168-.538.252-.826.252Z"
        />
      </svg>
    </button>
  )
}
