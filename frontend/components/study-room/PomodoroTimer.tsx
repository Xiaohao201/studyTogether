'use client'

import { useStudyRoomStore } from '@/store/studyRoomStore'

export function PomodoroTimer() {
  const timerState = useStudyRoomStore((s) => s.timerState)
  const isHost = useStudyRoomStore((s) => s.isHost)
  const startTimer = useStudyRoomStore((s) => s.startTimer)
  const pauseTimer = useStudyRoomStore((s) => s.pauseTimer)
  const resumeTimer = useStudyRoomStore((s) => s.resumeTimer)
  const skipPhase = useStudyRoomStore((s) => s.skipPhase)

  if (!timerState) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-4 opacity-50">⏱️</div>
        <p className="text-gray-500 dark:text-gray-400">
          等待参与者加入后开始计时...
        </p>
        {isHost && (
          <button
            onClick={startTimer}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            开始专注
          </button>
        )}
      </div>
    )
  }

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const isFocus = timerState.phase === 'focus'
  const phaseLabel = isFocus ? '专注时间' : '休息时间'
  const phaseColor = isFocus
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-green-600 dark:text-green-400'
  const ringColor = isFocus
    ? 'border-indigo-500'
    : 'border-green-500'

  return (
    <div className="flex flex-col items-center">
      {/* Phase label */}
      <div className={`text-lg font-semibold mb-3 ${phaseColor}`}>
        {phaseLabel}
      </div>

      {/* Circular timer */}
      <div className={`relative w-48 h-48 rounded-full border-8 ${ringColor} flex items-center justify-center mb-4`}>
        <div className="text-4xl font-mono font-bold text-gray-900 dark:text-white">
          {timeDisplay}
        </div>
      </div>

      {/* Status */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {timerState.isPaused ? '已暂停' : '计时中...'}
      </div>

      {/* Controls (host only) */}
      {isHost && (
        <div className="flex space-x-3">
          {timerState.isPaused ? (
            <button
              onClick={resumeTimer}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              继续
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
            >
              暂停
            </button>
          )}
          <button
            onClick={skipPhase}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            跳过
          </button>
        </div>
      )}
    </div>
  )
}
