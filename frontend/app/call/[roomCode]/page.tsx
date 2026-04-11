/**
 * Call Room Page
 *
 * Full-screen call interface for active calls.
 * Displays local/remote video and call controls.
 *
 * Socket event handlers are managed by callStore.registerSocketHandlers()
 * which is called once from the map page. This page only handles video
 * element binding and cleanup.
 */

"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCallStore } from '@/store/callStore'
import { CallControls, CallTimer } from '@/components/call/CallControls'
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
    isP2PConnected,
  } = useCallStore()

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

  // Redirect to map if no active call
  useEffect(() => {
    if (!isLoading && !activeCall && !error) {
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

      {/* Connection status indicator */}
      <div className="absolute top-2 right-2 z-40">
        <div className={`px-2 py-1 rounded text-xs ${isP2PConnected ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
          {isP2PConnected ? 'P2P Connected' : 'Connecting...'}
        </div>
      </div>

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
              <div className="absolute bottom-20 md:bottom-24 right-2 md:right-4 w-28 h-20 sm:w-32 sm:h-24 md:w-48 md:h-36 bg-gray-900 rounded-lg overflow-hidden shadow-lg border-2 border-white">
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
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 md:p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-base md:text-lg font-semibold">
              {activeCall?.call_type === 'video' ? 'Video Call' : 'Voice Call'}
            </h2>
            <p className="text-xs md:text-sm text-gray-300">Room: {params.roomCode}</p>
          </div>
          <CallTimer startTime={callStartTime} />
        </div>
      </div>

      {/* Call controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6 safe-bottom">
        <CallControls />
      </div>
    </div>
  )
}
