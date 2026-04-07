/**
 * CallControls component for in-call controls.
 *
 * Provides mute, camera toggle, and hangup buttons.
 */

"use client"

import { useState, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCallStore } from '@/store/callStore'

interface CallControlsProps {
  className?: string
}

export function CallControls({ className }: CallControlsProps) {
  const { isAudioEnabled, isVideoEnabled, toggleAudio, toggleVideo, endCall } =
    useCallStore()

  const handleEndCall = async () => {
    await endCall()
  }

  return (
    <div className={`flex items-center justify-center gap-4 ${className || ''}`}>
      {/* Mute/Unmute */}
      <Button
        size="lg"
        variant={isAudioEnabled ? 'outline' : 'destructive'}
        onClick={toggleAudio}
        className="h-14 w-14 rounded-full"
      >
        {isAudioEnabled ? (
          <Mic className="h-6 w-6" />
        ) : (
          <MicOff className="h-6 w-6" />
        )}
      </Button>

      {/* Hangup */}
      <Button
        size="lg"
        variant="destructive"
        onClick={handleEndCall}
        className="h-16 w-16 rounded-full"
      >
        <PhoneOff className="h-7 w-7" />
      </Button>

      {/* Camera On/Off */}
      <Button
        size="lg"
        variant={isVideoEnabled ? 'outline' : 'destructive'}
        onClick={toggleVideo}
        className="h-14 w-14 rounded-full"
      >
        {isVideoEnabled ? (
          <Video className="h-6 w-6" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </Button>
    </div>
  )
}

interface CallTimerProps {
  startTime: number | null
  className?: string
}

export function CallTimer({ startTime, className }: CallTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`text-sm font-mono text-muted-foreground ${className || ''}`}>
      {formatTime(elapsed)}
    </div>
  )
}
