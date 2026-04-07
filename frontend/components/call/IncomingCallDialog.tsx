/**
 * IncomingCallDialog component for displaying incoming call notifications.
 *
 * Shows when a user receives an incoming voice/video call.
 * Auto-dismisses after 30 seconds.
 */

"use client"

import { useEffect, useState } from 'react'
import { Phone, Video, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCallStore } from '@/store/callStore'
import type { IncomingCallOfferData } from '@/types'

interface IncomingCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incomingCall: {
    callerId: string
    callerUsername?: string
    roomCode: string
    callType: 'voice' | 'video'
    offer: IncomingCallOfferData
  } | null
}

export function IncomingCallDialog({
  open,
  onOpenChange,
  incomingCall,
}: IncomingCallDialogProps) {
  const { answerCall, rejectCall } = useCallStore()
  const [timeLeft, setTimeLeft] = useState(30)

  // Auto-dismiss countdown
  useEffect(() => {
    if (!open || !incomingCall) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Auto reject
          if (incomingCall) {
            rejectCall(incomingCall.callerId, incomingCall.roomCode)
          }
          onOpenChange(false)
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [open, incomingCall, onOpenChange, rejectCall])

  // Reset timer when dialog opens with new call
  useEffect(() => {
    if (open) {
      setTimeLeft(30)
    }
  }, [open])

  const handleAnswer = async () => {
    if (!incomingCall) return

    try {
      await answerCall(incomingCall.offer, incomingCall.callerUsername)
      onOpenChange(false)
    } catch (error) {
      console.error('[IncomingCallDialog] Failed to answer call:', error)
    }
  }

  const handleReject = () => {
    if (!incomingCall) return
    rejectCall(incomingCall.callerId, incomingCall.roomCode)
    onOpenChange(false)
  }

  if (!incomingCall) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                incomingCall.callType === 'video'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-green-100 text-green-600'
              }`}
            >
              {incomingCall.callType === 'video' ? (
                <Video className="h-6 w-6" />
              ) : (
                <Phone className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">
                {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
              </DialogTitle>
              <DialogDescription className="text-sm">
                {incomingCall.callerUsername || `User ${incomingCall.callerId.slice(0, 8)}`} is calling you...
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Auto-dismiss in</p>
            <p className="text-3xl font-bold">{timeLeft}s</p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-3 sm:justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={handleReject}
            className="flex-1 sm:flex-none"
          >
            <X className="h-4 w-4 mr-2" />
            Decline
          </Button>
          <Button
            size="lg"
            onClick={handleAnswer}
            className={`flex-1 sm:flex-none ${
              incomingCall.callType === 'video'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <Phone className="h-4 w-4 mr-2" />
            Answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
