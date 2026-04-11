'use client'

import { useStudyRoomStore } from '@/store/studyRoomStore'
import { useAuthStore } from '@/store/authStore'

export function ParticipantList() {
  const currentRoom = useStudyRoomStore((s) => s.currentRoom)
  const user = useAuthStore((s) => s.user)

  if (!currentRoom) return null

  const activeParticipants = currentRoom.participants.filter(
    (p) => p.left_at === null
  )

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        参与者 ({activeParticipants.length})
      </h3>
      {activeParticipants.map((participant) => {
        const isHostUser = participant.user_id === currentRoom.host_id
        const isMe = participant.user_id === user?.id

        return (
          <div
            key={participant.user_id}
            className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
          >
            {/* Avatar placeholder */}
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-medium shrink-0">
              {(participant.username || '?')[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {participant.username || '未知用户'}
                {isMe && (
                  <span className="text-xs text-gray-400 ml-1">(我)</span>
                )}
              </p>
            </div>

            {/* Host badge */}
            {isHostUser && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                房主
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
