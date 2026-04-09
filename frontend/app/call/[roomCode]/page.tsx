/**
 * Call Room Page
 *
 * Full-screen call interface for active calls.
 * Displays local/remote video and call controls.
 */

"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCallStore } from '@/store/callStore'
import { CallControls, CallTimer } from '@/components/call/CallControls'
import { getCallSocket } from '@/lib/callSocket'
import { useAuthStore } from '@/store'

export default function CallRoomPage({ params }: { params: { roomCode: string } }) {
  const router = useRouter()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const { user } = useAuthStore()

  const {
    localStream,
    remoteStream,
    callStartTime,
    activeCall,
    isLoading,
    error,
    webrtcManager,
    cleanup,
  } = useCallStore()

  const [socketInitialized, setSocketInitialized] = useState(false)

  // Set up Socket.io event listeners
  useEffect(() => {
    if (socketInitialized) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const callSocket = getCallSocket()
    callSocket.connect(token)

    // Register call event handlers (merge with existing, don't replace)
    callSocket.on({
      onCallAnswered: (data) => {
        useCallStore.getState().handleCallAnswered(data)
      },
      onIceCandidate: (data) => {
        useCallStore.getState().handleIceCandidate(data)
      },
      onCallEnded: (data) => {
        useCallStore.getState().handleCallEnded(data)
        router.push('/map')
      },
      onCallRejected: (data) => {
        useCallStore.getState().handleCallRejected(data)
        router.push('/map')
      },
      onParticipantMediaChanged: (data) => {
        useCallStore.getState().handleParticipantMediaChanged(data)
      },
      onCallUserUnavailable: (data) => {
        useCallStore.getState().handleUserUnavailable(data)
        router.push('/map')
      },
    })

    setSocketInitialized(true)

    return () => {
      // Don't disconnect here, let the store handle it
    }
  }, [router, socketInitialized])

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Redirect if no active call
  useEffect(() => {
    if (!isLoading && !activeCall && !error) {
      // Check if room code matches params
      const checkRoom = async () => {
        try {
          const { callsApi } = await import('@/lib/api')
          const room = await callsApi.getCallRoom(params.roomCode)
          if (!room) {
            router.push('/map')
          }
        } catch {
          router.push('/map')
        }
      }
      checkRoom()
    }
  }, [activeCall, isLoading, error, router, params.roomCode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Read current state from store to avoid stale closure
      const currentState = useCallStore.getState()
      if (currentState.activeCall?.room_code === params.roomCode) {
        currentState.cleanup()
      }
    }
  }, [params.roomCode])

  // Redirect to map if call ended
  if (!activeCall && !isLoading) {
    router.push('/map')
    return null
  }

  const isVideoCall = activeCall?.call_type === 'video'

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Error message */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Video area */}
      <div className="flex-1 relative">
        {isVideoCall ? (
          <>
            {/* Remote video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local video (picture-in-picture) */}
            {localStream && (
              <div className="absolute bottom-24 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-lg border-2 border-white">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </>
        ) : (
          // Voice call - show audio visualization placeholder
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-4xl">🎙️</span>
              </div>
              <p className="text-xl font-semibold">
                {activeCall?.participants.find((p) => p.user_id !== user?.id)?.user_id ||
                  'In Call'}
              </p>
              <p className="text-sm text-gray-400">Voice Call in Progress</p>
            </div>
          </div>
        )}
      </div>

      {/* Call info bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-lg font-semibold">
              {activeCall?.call_type === 'video' ? 'Video Call' : 'Voice Call'}
            </h2>
            <p className="text-sm text-gray-300">Room: {params.roomCode}</p>
          </div>
          <CallTimer startTime={callStartTime} />
        </div>
      </div>

      {/* Call controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
        <CallControls />
      </div>
    </div>
  )
}
