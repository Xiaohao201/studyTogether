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
  isP2PConnected: boolean

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

  // Actions - Socket handler registration
  registerSocketHandlers: () => void

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
  isP2PConnected: false,

  /**
   * Register all call-related socket handlers on the singleton CallSocketManager.
   * This should be called once on app load (from map page) so handlers persist
   * across page navigations and are never lost during redirect.
   */
  registerSocketHandlers: () => {
    const callSocket = getCallSocket()

    callSocket.on({
      onIncomingCallOffer: (data) => {
        console.log('[CallStore] Incoming call offer:', data.callerId, data.roomCode)
        get().setIncomingCall({
          callerId: data.callerId,
          roomCode: data.roomCode,
          callType: data.callType || 'voice',
          offer: data,
        })
      },
      onCallAnswered: (data) => {
        console.log('[CallStore] Received call-answered event')
        get().handleCallAnswered(data)
      },
      onIceCandidate: (data) => {
        console.log('[CallStore] Received ICE candidate')
        get().handleIceCandidate(data)
      },
      onCallEnded: (data) => {
        console.log('[CallStore] Received call-ended event')
        get().handleCallEnded(data)
      },
      onCallRejected: (data) => {
        console.log('[CallStore] Received call-rejected event')
        get().handleCallRejected(data)
      },
      onParticipantMediaChanged: (data) => {
        get().handleParticipantMediaChanged(data)
      },
      onCallUserUnavailable: (data) => {
        get().handleUserUnavailable(data)
      },
    })

    console.log('[CallStore] Socket handlers registered')
  },

  initiateCall: async (targetUserId: string, callType: CallType) => {
    set({ isLoading: true, error: null, isP2PConnected: false })
    try {
      // Create call room via REST API
      const callRoom = await callsApi.startCall(targetUserId, callType)
      console.log('[CallStore] Call room created:', callRoom.room_code)

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
        console.log('[CallStore] Remote track received:', event.track.kind)
        const tracks = event.streams[0]?.getTracks() || [event.track]
        const newStream = new MediaStream(tracks)
        set({ remoteStream: newStream })
      })

      // Set up ICE candidate handler to send via socket
      webrtcManager.onIceCandidateCallback((candidate) => {
        console.log('[CallStore] Sending ICE candidate')
        const callSocket = getCallSocket()
        callSocket.sendIceCandidate({
          targetUserId,
          candidate,
        })
      })

      // Monitor connection state for P2P status
      webrtcManager.onConnectionStateChangeCallback((state) => {
        console.log('[CallStore] WebRTC connection state:', state)
        if (state === 'connected') {
          set({ isP2PConnected: true })
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          set({ isP2PConnected: false })
        }
      })

      // Create offer
      const offer = await webrtcManager.createOffer()
      console.log('[CallStore] Offer created, sending via socket')

      // Send offer via socket
      const callSocket = getCallSocket()
      callSocket.sendCallOffer({
        targetUserId,
        roomCode: callRoom.room_code,
        callType,
        offer,
      })

      console.log('[CallStore] Offer sent, setting activeCall')

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
      console.error('[CallStore] initiateCall error:', error)
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
    set({ isLoading: true, error: null, isP2PConnected: false })
    try {
      // Get call room details
      const callRoom = await callsApi.getCallRoom(offer.roomCode)
      console.log('[CallStore] Answering call in room:', offer.roomCode)

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
        console.log('[CallStore] Remote track received:', event.track.kind)
        const tracks = event.streams[0]?.getTracks() || [event.track]
        const newStream = new MediaStream(tracks)
        set({ remoteStream: newStream })
      })

      // Set up ICE candidate handler to send via socket
      webrtcManager.onIceCandidateCallback((candidate) => {
        console.log('[CallStore] Sending ICE candidate')
        const callSocket = getCallSocket()
        callSocket.sendIceCandidate({
          targetUserId: offer.callerId,
          candidate,
        })
      })

      // Monitor connection state for P2P status
      webrtcManager.onConnectionStateChangeCallback((state) => {
        console.log('[CallStore] WebRTC connection state:', state)
        if (state === 'connected') {
          set({ isP2PConnected: true })
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          set({ isP2PConnected: false })
        }
      })

      // Set remote description (offer)
      await webrtcManager.setRemoteDescription(offer.offer)
      console.log('[CallStore] Remote description (offer) set')

      // Create answer
      const answer = await webrtcManager.createAnswer()
      console.log('[CallStore] Answer created, sending via socket')

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
      console.error('[CallStore] answerCall error:', error)
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
      console.log('[CallStore] Setting remote description (answer)')
      await webrtcManager.setRemoteDescription(data.answer)
      console.log('[CallStore] Call answered successfully - remote description set')
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
      console.log('[CallStore] ICE candidate added')
    } catch (error) {
      console.error('[CallStore] Error handling ICE candidate:', error)
    }
  },

  handleCallEnded: (data: CallEndedData) => {
    console.log('[CallStore] Call ended:', data)
    get().cleanup()
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
      await callsApi.endCall(callId)

      const callSocket = getCallSocket()
      callSocket.sendCallEnded({
        roomCode,
        userId: hostId,
      })
    } catch {
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

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    if (webrtcManager) {
      webrtcManager.close()
    }

    set({
      activeCall: null,
      incomingCall: null,
      localStream: null,
      remoteStream: null,
      webrtcManager: null,
      isCallInitiator: false,
      callStartTime: null,
      error: null,
      isP2PConnected: false,
    })
  },

  clearError: () => set({ error: null }),
}))
