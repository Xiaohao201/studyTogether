'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { useStudyRoomStore } from '@/store/studyRoomStore'

interface StudyRoomButtonProps {
  userId: string
  username: string
  subject?: string | null
  variant?: 'default' | 'icon'
  onRoomCreated?: (roomCode: string) => void
}

export function StudyRoomButton({
  userId,
  username,
  subject,
  variant = 'default',
  onRoomCreated,
}: StudyRoomButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const createRoom = useStudyRoomStore((s) => s.createRoom)

  const handleStudyTogether = async () => {
    setIsLoading(true)
    try {
      const room = await createRoom(userId, subject)
      if (room && onRoomCreated) {
        onRoomCreated(room.room_code)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleStudyTogether}
        disabled={isLoading}
        title={`邀请 ${username} 一起学习`}
      >
        {isLoading ? '...' : '一起学习'}
      </Button>
    )
  }

  return (
    <Button
      onClick={handleStudyTogether}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? '创建中...' : `邀请 ${username} 一起学习`}
    </Button>
  )
}
