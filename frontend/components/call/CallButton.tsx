/**
 * CallButton component for initiating voice/video calls.
 *
 * Renders phone and video camera buttons to call nearby users.
 */

import { Phone, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCallStore } from '@/store/callStore'
import { getCallSocket } from '@/lib/callSocket'
import type { CallType } from '@/types'

interface CallButtonProps {
  userId: string
  username: string
  disabled?: boolean
  variant?: 'default' | 'icon' | 'split'
  onCallInitiated?: () => void
}

export function CallButton({
  userId,
  username,
  disabled = false,
  variant = 'default',
  onCallInitiated,
}: CallButtonProps) {
  const { initiateCall, isLoading } = useCallStore()

  const handleInitiateCall = async (callType: CallType) => {
    const callSocket = getCallSocket()
    if (!callSocket.isConnected()) {
      const token = localStorage.getItem('access_token')
      if (!token) return
      callSocket.connect(token)
    }

    try {
      await initiateCall(userId, callType)
      onCallInitiated?.()
    } catch (error) {
      console.error(`[CallButton] Failed to initiate ${callType} call:`, error)
    }
  }

  if (variant === 'icon') {
    return (
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled || isLoading}
          onClick={() => handleInitiateCall('voice')}
          title={`Voice call ${username}`}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled || isLoading}
          onClick={() => handleInitiateCall('video')}
          title={`Video call ${username}`}
        >
          <Video className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (variant === 'split') {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          onClick={() => handleInitiateCall('voice')}
          className="flex-1"
        >
          <Phone className="h-4 w-4 mr-2" />
          Voice
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={disabled || isLoading}
          onClick={() => handleInitiateCall('video')}
          className="flex-1"
        >
          <Video className="h-4 w-4 mr-2" />
          Video
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || isLoading}
        onClick={() => handleInitiateCall('voice')}
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        variant="default"
        size="sm"
        disabled={disabled || isLoading}
        onClick={() => handleInitiateCall('video')}
      >
        <Video className="h-4 w-4" />
      </Button>
    </div>
  )
}
