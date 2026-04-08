/**
 * Socket.io client for call signaling.
 *
 * Handles WebRTC signaling events for video/voice calls.
 */

import { io, Socket } from 'socket.io-client'
import type {
  CallOfferData,
  CallAnswerData,
  IceCandidateData,
  IncomingCallOfferData,
  CallAnsweredData,
  IceCandidateReceivedData,
  CallRejectedData,
  CallEndedData,
  ParticipantMediaChangedData,
} from '@/types'

export interface CallSocketCallbacks {
  onIncomingCallOffer?: (data: IncomingCallOfferData) => void
  onCallAnswered?: (data: CallAnsweredData) => void
  onIceCandidate?: (data: IceCandidateReceivedData) => void
  onCallRejected?: (data: CallRejectedData) => void
  onCallEnded?: (data: CallEndedData) => void
  onParticipantMediaChanged?: (data: ParticipantMediaChangedData) => void
  onCallUserUnavailable?: (data: { roomCode: string; userId: string }) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: string) => void
}

class CallSocketManager {
  private socket: Socket | null = null
  private token: string | null = null
  private callbacks: CallSocketCallbacks = {}

  /**
   * Initialize Socket.io connection.
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn('[CallSocket] Already connected')
      return
    }

    this.token = token

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    this.socket = io(`${backendUrl}/socket.io`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    this.setupEventHandlers()
  }

  /**
   * Set up event handlers.
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[CallSocket] Connected:', this.socket?.id)
      this.callbacks.onConnected?.()
    })

    this.socket.on('disconnect', () => {
      console.log('[CallSocket] Disconnected')
      this.callbacks.onDisconnected?.()
    })

    this.socket.on('connect_error', (error) => {
      console.error('[CallSocket] Connection error:', error)
      this.callbacks.onError?.(error.message)
    })

    // Call events
    this.socket.on('incoming-call-offer', (data: IncomingCallOfferData) => {
      console.log('[CallSocket] Incoming call offer:', data)
      this.callbacks.onIncomingCallOffer?.(data)
    })

    this.socket.on('call-answered', (data: CallAnsweredData) => {
      console.log('[CallSocket] Call answered:', data)
      this.callbacks.onCallAnswered?.(data)
    })

    this.socket.on('ice-candidate', (data: IceCandidateReceivedData) => {
      this.callbacks.onIceCandidate?.(data)
    })

    this.socket.on('call-rejected', (data: CallRejectedData) => {
      console.log('[CallSocket] Call rejected:', data)
      this.callbacks.onCallRejected?.(data)
    })

    this.socket.on('call-ended', (data: CallEndedData) => {
      console.log('[CallSocket] Call ended:', data)
      this.callbacks.onCallEnded?.(data)
    })

    this.socket.on('participant-media-changed', (data: ParticipantMediaChangedData) => {
      console.log('[CallSocket] Participant media changed:', data)
      this.callbacks.onParticipantMediaChanged?.(data)
    })

    this.socket.on('call-user-unavailable', (data: { roomCode: string; userId: string }) => {
      console.log('[CallSocket] Call user unavailable:', data)
      this.callbacks.onCallUserUnavailable?.(data)
    })
  }

  /**
   * Register event callbacks (merges with existing).
   */
  on(callbacks: CallSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Replace all event callbacks.
   */
  replaceCallbacks(callbacks: CallSocketCallbacks): void {
    this.callbacks = { ...callbacks }
  }

  /**
   * Clear all event callbacks.
   */
  clearCallbacks(): void {
    this.callbacks = {}
  }

  /**
   * Send call offer to target user.
   */
  sendCallOffer(data: CallOfferData): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('call_offer', data)
  }

  /**
   * Send call answer to caller.
   */
  sendCallAnswer(data: CallAnswerData): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('call_answer', data)
  }

  /**
   * Send ICE candidate.
   */
  sendIceCandidate(data: IceCandidateData): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('ice_candidate', data)
  }

  /**
   * Reject incoming call.
   */
  sendCallReject(data: { callerId: string; roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('call_reject', data)
  }

  /**
   * End call.
   */
  sendCallEnded(data: { roomCode: string; userId: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('call_ended', data)
  }

  /**
   * Send media toggle event.
   */
  sendMediaToggle(data: {
    roomCode: string
    hasAudio: boolean
    hasVideo: boolean
  }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('media_toggle', data)
  }

  /**
   * Disconnect socket.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.token = null
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Get socket ID.
   */
  getId(): string | undefined {
    return this.socket?.id
  }
}

// Singleton instance
let callSocketInstance: CallSocketManager | null = null

export function getCallSocket(): CallSocketManager {
  if (!callSocketInstance) {
    callSocketInstance = new CallSocketManager()
  }
  return callSocketInstance
}

export function initializeCallSocket(token: string): CallSocketManager {
  const socket = getCallSocket()
  socket.connect(token)
  return socket
}
