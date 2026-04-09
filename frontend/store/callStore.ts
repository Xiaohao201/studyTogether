// Call store using Zustand
import { create } from 'zustand'
import { callsApi } from '@/lib/api'
import { getCallSocket } from '@/lib/callSocket'
import { WebRTCManager } from '@/lib/webrtc'
import type {
  CallRoom,
  CallRoomCreate,
  CallType,
  IncomingCallOfferData,
  CallAnsweredData,
  IceCandidateReceivedData,
  CallRejectedData,
  CallEndedData,
  ParticipantMediaChangedData,
} from '@/types'

interface IncomingCall {
  callerId: string
  callerUsername?: string
  roomCode: string
  callType: CallType
  offer: IncomingCallOfferData
}

interface CallState {
  // State
  activeCall: CallRoom | null
  incomingCall: IncomingCall | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isCallInitiator: boolean
  callStartTime: number | null
  isLoading: boolean
  error: string | null

  // WebRTC & Socket
  webrtcManager: WebRTCManager | null

  // Actions - Initiate Call
  initiateCall: (targetUserId: string, callType: CallType) => Promise<void>

  // Actions - Answer Call
  answerCall: (offer: IncomingCallOfferData, callerUsername?: string) => Promise<void>

  // Actions - Set incoming call from socket
  setIncomingCall: (call: IncomingCall) => void

  // Actions - Reject Call
  rejectCall: (callerId: string, roomCode: string) => void

  // Actions - During Call
  toggleAudio: () => void
  toggleVideo: () => void
  endCall: () => Promise<void>

  // Actions - Internal
  handleCallAnswered: (data: CallAnsweredData) => Promise<void>
  handleIceCandidate: (data: IceCandidateReceivedData) => Promise<void>
  handleCallEnded: (data: CallEndedData) => void
  handleCallRejected: (data: CallRejectedData) => void
  handleParticipantMediaChanged: (data: ParticipantMediaChangedData) => void
  handleUserUnavailable: (data: { roomCode: string; userId: string }) => void

  // Actions - Cleanup
  cleanup: () => void
  clearError: () => void
}

export const useCallStore = create<CallState>((set, get) => ({
  // Initial state
  activeCall: null,
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isCallInitiator: false,
  callStartTime: null,
  isLoading: false,
  error: null,
  webrtcManager: null,

  initiateCall: async (targetUserId: string, callType: CallType) => {
    set({ isLoading: true, error: null })
    try {
      // Create call room via REST API
      const callRoom = await callsApi.startCall(targetUserId, callType)

      // Initialize WebRTC
      const webrtcManager = new WebRTCManager()
      await webrtcManager.fetchIceServers()
      const constraints = {
        audio: true,
        video: callType === 'video',
      }

      let localStream: MediaStream
      try {
        localStream = await webrtcManager.initLocalStream(constraints)
      } catch (mediaError: any) {
        // Clean up the call room if media fails
        try {
          await callsApi.endCall(callRoom.id)
        } catch { /* ignore cleanup error */ }
        const msg = mediaError.name === 'NotAllowedError'
          ? '请允许使用摄像头和麦克风权限后再发起通话'
          : mediaError.name === 'NotFoundError'
            ? '未找到摄像头或麦克风设备'
            : '无法访问摄像头或麦克风，请检查设备'
        set({ error: msg, isLoading: false })
        return
      }

      webrtcManager.createPeerConnection()
      webrtcManager.addLocalTracks()

      // Set up remote track handler to capture remote stream
      webrtcManager.onTrackCallback((event) => {
        const newStream = new MediaStream()
        event.streams[0]?.getTracks().forEach((track) => {
          newStream.addTrack(track)
        })
        set({ remoteStream: newStream })
      })

      // Set up ICE candidate handler to send via socket
      webrtcManager.onIceCandidateCallback((candidate) => {
        const callSocket = getCallSocket()
        callSocket.sendIceCandidate({
          targetUserId,
          candidate,
        })
      })

      // Create offer
      const offer = await webrtcManager.createOffer()

      // Send offer via socket
      const callSocket = getCallSocket()
      callSocket.sendCallOffer({
        targetUserId,
        roomCode: callRoom.room_code,
        callType,
        offer,
      })

      set({
        activeCall: callRoom,
        localStream,
        isCallInitiator: true,
        callStartTime: Date.now(),
        isVideoEnabled: callType === 'video',
        isAudioEnabled: true,
        webrtcManager,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '发起通话失败',
        isLoading: false,
      })
    }
  },

  answerCall: async (
    offer: IncomingCallOfferData,
    callerUsername?: string
  ) => {
    set({ isLoading: true, error: null })
    try {
      // Get call room details
      const callRoom = await callsApi.getCallRoom(offer.roomCode)

      // Initialize WebRTC
      const webrtcManager = new WebRTCManager()
      await webrtcManager.fetchIceServers()
      const constraints = {
        audio: true,
        video: callRoom.call_type === 'video',
      }

      let localStream: MediaStream
      try {
        localStream = await webrtcManager.initLocalStream(constraints)
      } catch (mediaError: any) {
        // Reject call if media access fails
        const callSocket = getCallSocket()
        callSocket.sendCallReject({ callerId: offer.callerId, roomCode: offer.roomCode })
        const msg = mediaError.name === 'NotAllowedError'
          ? '请允许使用摄像头和麦克风权限后再接听通话'
          : mediaError.name === 'NotFoundError'
            ? '未找到摄像头或麦克风设备'
            : '无法访问摄像头或麦克风，请检查设备'
        set({ error: msg, isLoading: false, incomingCall: null })
        return
      }

      webrtcManager.createPeerConnection()
      webrtcManager.addLocalTracks()

      // Set up remote track handler to capture remote stream
      webrtcManager.onTrackCallback((event) => {
        const newStream = new MediaStream()
        event.streams[0]?.getTracks().forEach((track) => {
          newStream.addTrack(track)
        })
        set({ remoteStream: newStream })
      })

      // Set up ICE candidate handler to send via socket
      webrtcManager.onIceCandidateCallback((candidate) => {
        const callSocket = getCallSocket()
        callSocket.sendIceCandidate({
          targetUserId: offer.callerId,
          candidate,
        })
      })

      // Set remote description (offer)
      await webrtcManager.setRemoteDescription(offer.offer)

      // Create answer
      const answer = await webrtcManager.createAnswer()

      // Send answer via socket
      const callSocket = getCallSocket()
      callSocket.sendCallAnswer({
        callerId: offer.callerId,
        roomCode: offer.roomCode,
        answer,
      })

      set({
        activeCall: callRoom,
        localStream,
        incomingCall: null,
        isCallInitiator: false,
        callStartTime: Date.now(),
        isVideoEnabled: callRoom.call_type === 'video',
        isAudioEnabled: true,
        webrtcManager,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '接听通话失败',
        isLoading: false,
      })
    }
  },

  rejectCall: (callerId: string, roomCode: string) => {
    const callSocket = getCallSocket()
    callSocket.sendCallReject({ callerId, roomCode })
    set({ incomingCall: null })
  },

  setIncomingCall: (call: IncomingCall) => {
    set({ incomingCall: call })
  },

  handleCallAnswered: async (data: CallAnsweredData) => {
    const { webrtcManager } = get()
    if (!webrtcManager) {
      console.error('[CallStore] No WebRTC manager for call answer')
      return
    }

    try {
      await webrtcManager.setRemoteDescription(data.answer)
      console.log('[CallStore] Call answered successfully')
    } catch (error) {
      console.error('[CallStore] Error handling call answer:', error)
      set({ error: 'Failed to establish connection' })
    }
  },

  handleIceCandidate: async (data: IceCandidateReceivedData) => {
    const { webrtcManager } = get()
    if (!webrtcManager) {
      console.warn('[CallStore] No WebRTC manager for ICE candidate')
      return
    }

    try {
      await webrtcManager.addIceCandidate(data.candidate)
    } catch (error) {
      console.error('[CallStore] Error handling ICE candidate:', error)
    }
  },

  handleCallEnded: (data: CallEndedData) => {
    const { cleanup } = get()
    console.log('[CallStore] Call ended:', data)
    cleanup()
  },

  handleCallRejected: (data: CallRejectedData) => {
    console.log('[CallStore] Call rejected:', data)
    const { activeCall, cleanup } = get()

    if (activeCall?.room_code === data.roomCode) {
      cleanup()
      set({ error: 'Call was rejected by the other user' })
    }
  },

  handleParticipantMediaChanged: (data: ParticipantMediaChangedData) => {
    console.log('[CallStore] Participant media changed:', data)
    // Can be used to update UI indicators for remote participant
  },

  handleUserUnavailable: (data: { roomCode: string; userId: string }) => {
    const { activeCall, cleanup } = get()
    if (activeCall?.room_code === data.roomCode) {
      cleanup()
      set({ error: 'User is unavailable' })
    }
  },

  toggleAudio: () => {
    const { webrtcManager, isAudioEnabled } = get()
    if (webrtcManager) {
      const newState = !isAudioEnabled
      webrtcManager.toggleAudio(newState)
      set({ isAudioEnabled: newState })

      // Notify via socket
      const { activeCall } = get()
      if (activeCall) {
        const callSocket = getCallSocket()
        callSocket.sendMediaToggle({
          roomCode: activeCall.room_code,
          hasAudio: newState,
          hasVideo: get().isVideoEnabled,
        })
      }
    }
  },

  toggleVideo: () => {
    const { webrtcManager, isVideoEnabled } = get()
    if (webrtcManager) {
      const newState = !isVideoEnabled
      webrtcManager.toggleVideo(newState)
      set({ isVideoEnabled: newState })

      // Notify via socket
      const { activeCall } = get()
      if (activeCall) {
        const callSocket = getCallSocket()
        callSocket.sendMediaToggle({
          roomCode: activeCall.room_code,
          hasAudio: get().isAudioEnabled,
          hasVideo: newState,
        })
      }
    }
  },

  endCall: async () => {
    const { activeCall, cleanup } = get()

    if (!activeCall) {
      return
    }

    const roomCode = activeCall.room_code
    const callId = activeCall.id
    const hostId = activeCall.host_id

    try {
      // REST first to ensure DB is updated
      await callsApi.endCall(callId)

      // Then notify via socket
      const callSocket = getCallSocket()
      callSocket.sendCallEnded({
        roomCode,
        userId: hostId,
      })
    } catch {
      // Still try to notify even if REST fails
      const callSocket = getCallSocket()
      callSocket.sendCallEnded({
        roomCode,
        userId: hostId,
      })
    } finally {
      cleanup()
    }
  },

  cleanup: () => {
    const { webrtcManager, localStream } = get()

    // Stop media tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    // Close WebRTC
    if (webrtcManager) {
      webrtcManager.close()
    }

    // Clear only call-specific callbacks, preserve other handlers (study room, etc.)
    const callSocket = getCallSocket()
    callSocket.on({
      onCallAnswered: undefined,
      onIceCandidate: undefined,
      onCallEnded: undefined,
      onCallRejected: undefined,
      onParticipantMediaChanged: undefined,
      onCallUserUnavailable: undefined,
    })

    set({
      activeCall: null,
      incomingCall: null,
      localStream: null,
      remoteStream: null,
      webrtcManager: null,
      isCallInitiator: false,
      callStartTime: null,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
}))
