'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useStudyRoomStore } from '@/store/studyRoomStore'
import { getCallSocket } from '@/lib/callSocket'
import { PomodoroTimer } from '@/components/study-room/PomodoroTimer'
import { ChatPanel } from '@/components/study-room/ChatPanel'
import { ParticipantList } from '@/components/study-room/ParticipantList'
import type {
  TimerState,
  TimerPhaseChanged,
  StudyRoomMessageData,
  StudyRoomLeft,
  StudyRoomEnded,
} from '@/types'

export default function StudyRoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomCode as string

  const { user, isAuthenticated } = useAuthStore()
  const {
    currentRoom,
    isHost,
    isLoading,
    error,
    timerState,
    fetchRoom,
    endRoom,
    leaveRoom,
    handleTimerState,
    handleTimerPhaseChanged,
    handleIncomingMessage,
    handleParticipantLeft,
    handleRoomEnded,
    fetchMessages,
    cleanup,
    clearError,
  } = useStudyRoomStore()

  const socketRegistered = useRef(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // Fetch room data on mount
  useEffect(() => {
    if (!isAuthenticated || !roomCode) return
    fetchRoom(roomCode)
    fetchMessages(roomCode)
  }, [isAuthenticated, roomCode])

  // Register socket handlers and emit join
  useEffect(() => {
    if (!isAuthenticated || !roomCode || socketRegistered.current) return

    const callSocket = getCallSocket()

    callSocket.on({
      onTimerState: (data: TimerState) => {
        if (data.roomCode === roomCode) {
          handleTimerState(data)
        }
      },
      onTimerPhaseChanged: (data: TimerPhaseChanged) => {
        if (data.roomCode === roomCode) {
          handleTimerPhaseChanged(data)
        }
      },
      onStudyRoomMessage: (data: StudyRoomMessageData) => {
        if (data.roomCode === roomCode) {
          handleIncomingMessage(data)
        }
      },
      onStudyRoomLeft: (data: StudyRoomLeft) => {
        if (data.roomCode === roomCode) {
          handleParticipantLeft(data)
        }
      },
      onStudyRoomEnded: (data: StudyRoomEnded) => {
        if (data.roomCode === roomCode) {
          handleRoomEnded(data)
          router.push('/map')
        }
      },
    })

    // Emit join event (wait for connection)
    callSocket.sendStudyRoomJoin({ roomCode }).catch(() => {})

    socketRegistered.current = true

    return () => {
      socketRegistered.current = false
    }
  }, [isAuthenticated, roomCode])

  // Handle room ended or not found
  useEffect(() => {
    if (currentRoom && currentRoom.room_status === 'ended') {
      router.push('/map')
    }
  }, [currentRoom?.room_status, router])

  const handleEndRoom = async () => {
    await endRoom()
    router.push('/map')
  }

  const handleLeaveRoom = async () => {
    await leaveRoom()
    router.push('/map')
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  if (isLoading && !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📖</div>
          <p className="text-gray-500">加载学习房间...</p>
        </div>
      </div>
    )
  }

  if (error && !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/map')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            返回地图
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/map')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ← 返回
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                学习房间
              </h1>
              {currentRoom?.subject && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400">
                  {currentRoom.subject}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-400">
              房间号: {roomCode}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              currentRoom?.room_status === 'active'
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
            }`}>
              {currentRoom?.room_status === 'active' ? '进行中' : '等待中'}
            </span>
            {isHost ? (
              <button
                onClick={handleEndRoom}
                className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
              >
                结束房间
              </button>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                离开房间
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content: Timer + Chat + Participants */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Timer */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-6">
          <PomodoroTimer />
        </div>

        {/* Center: Chat */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              聊天
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>

        {/* Right: Participants */}
        <div className="w-1/3 p-4 overflow-y-auto">
          <ParticipantList />
        </div>
      </div>
    </div>
  )
}
