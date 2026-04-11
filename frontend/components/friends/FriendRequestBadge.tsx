'use client'

import { useFriendStore } from '@/store/friendStore'
import { useEffect } from 'react'

interface FriendRequestBadgeProps {
  onClick: () => void
}

export function FriendRequestBadge({ onClick }: FriendRequestBadgeProps) {
  const { pendingRequests, fetchPendingRequests } = useFriendStore()
  const count = pendingRequests.received.length

  useEffect(() => {
    fetchPendingRequests()
  }, [fetchPendingRequests])

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      aria-label={`${count} pending friend requests`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
      </svg>
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  )
}
