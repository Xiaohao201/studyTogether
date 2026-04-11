'use client'

import { useEffect } from 'react'
import { Button } from '../ui/button'
import { useStudyRoomStore } from '@/store/studyRoomStore'
import type { IncomingStudyInvite } from '@/types'

interface IncomingStudyInviteDialogProps {
  invite: IncomingStudyInvite | null
  onAccept?: (invite: IncomingStudyInvite) => void
}

export function IncomingStudyInviteDialog({
  invite,
  onAccept,
}: IncomingStudyInviteDialogProps) {
  const acceptInvite = useStudyRoomStore((s) => s.acceptInvite)
  const rejectInvite = useStudyRoomStore((s) => s.rejectInvite)

  if (!invite) return null

  const handleAccept = () => {
    acceptInvite(invite)
    if (onAccept) {
      onAccept(invite)
    }
  }

  const handleReject = () => {
    rejectInvite(invite)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl safe-bottom">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">📖</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            学习邀请
          </h3>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          <span className="font-medium">{invite.inviterUsername}</span>
          {' '}邀请你一起学习
          {invite.subject && (
            <span className="text-indigo-600 dark:text-indigo-400">
              {' '}{invite.subject}
            </span>
          )}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleReject}
            className="min-h-[48px] min-w-[120px]"
          >
            拒绝
          </Button>
          <Button
            onClick={handleAccept}
            className="min-h-[48px] min-w-[120px] bg-indigo-600 hover:bg-indigo-700"
          >
            接受
          </Button>
        </div>
      </div>
    </div>
  )
}
