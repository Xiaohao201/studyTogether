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
  IncomingStudyInvite,
  StudyInviteAccepted,
  StudyInviteRejected,
  StudyRoomJoined,
  StudyRoomLeft,
  StudyRoomEnded,
  TimerState,
  TimerPhaseChanged,
  StudyRoomMessageData,
} from '@/types'

export interface CallSocketCallbacks {
  onIncomingCallOffer?: (data: IncomingCallOfferData) => void
  onCallAnswered?: (data: CallAnsweredData) => void
  onIceCandidate?: (data: IceCandidateReceivedData) => void
  onCallRejected?: (data: CallRejectedData) => void
  onCallEnded?: (data: CallEndedData) => void
  onParticipantMediaChanged?: (data: ParticipantMediaChangedData) => void
  onCallUserUnavailable?: (data: { roomCode: string; userId: string }) => void
  // Study room callbacks
  onIncomingStudyInvite?: (data: IncomingStudyInvite) => void
  onStudyInviteAccepted?: (data: StudyInviteAccepted) => void
  onStudyInviteRejected?: (data: StudyInviteRejected) => void
  onStudyRoomJoined?: (data: StudyRoomJoined) => void
  onStudyRoomLeft?: (data: StudyRoomLeft) => void
  onStudyRoomEnded?: (data: StudyRoomEnded) => void
  onTimerState?: (data: TimerState) => void
  onTimerPhaseChanged?: (data: TimerPhaseChanged) => void
  onStudyRoomMessage?: (data: StudyRoomMessageData) => void
  onStudyInviteFailed?: (data: { roomCode: string; reason: string }) => void
  // Connection
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

    // Study room events
    this.socket.on('incoming-study-invite', (data: IncomingStudyInvite) => {
      console.log('[CallSocket] Incoming study invite:', data)
      this.callbacks.onIncomingStudyInvite?.(data)
    })

    this.socket.on('study-invite-accepted', (data: StudyInviteAccepted) => {
      console.log('[CallSocket] Study invite accepted:', data)
      this.callbacks.onStudyInviteAccepted?.(data)
    })

    this.socket.on('study-invite-rejected', (data: StudyInviteRejected) => {
      console.log('[CallSocket] Study invite rejected:', data)
      this.callbacks.onStudyInviteRejected?.(data)
    })

    this.socket.on('study-room-joined', (data: StudyRoomJoined) => {
      console.log('[CallSocket] Study room joined:', data)
      this.callbacks.onStudyRoomJoined?.(data)
    })

    this.socket.on('study-room-left', (data: StudyRoomLeft) => {
      console.log('[CallSocket] Study room left:', data)
      this.callbacks.onStudyRoomLeft?.(data)
    })

    this.socket.on('study-room-ended', (data: StudyRoomEnded) => {
      console.log('[CallSocket] Study room ended:', data)
      this.callbacks.onStudyRoomEnded?.(data)
    })

    this.socket.on('timer-state', (data: TimerState) => {
      this.callbacks.onTimerState?.(data)
    })

    this.socket.on('timer-phase-changed', (data: TimerPhaseChanged) => {
      console.log('[CallSocket] Timer phase changed:', data)
      this.callbacks.onTimerPhaseChanged?.(data)
    })

    this.socket.on('study-room-message', (data: StudyRoomMessageData) => {
      this.callbacks.onStudyRoomMessage?.(data)
    })

    this.socket.on('study-invite-failed', (data: { roomCode: string; reason: string }) => {
      console.log('[CallSocket] Study invite failed:', data)
      this.callbacks.onStudyInviteFailed?.(data)
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

  // ===== Study Room Methods =====

  /**
   * Send study room invite.
   */
  sendStudyRoomInvite(data: {
    targetUserId: string
    roomCode: string
    subject: string | null
    inviterUsername: string
  }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_invite', data)
  }

  /**
   * Accept study room invite.
   */
  sendStudyRoomAccept(data: { roomCode: string; inviterId: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_accept', data)
  }

  /**
   * Reject study room invite.
   */
  sendStudyRoomReject(data: { roomCode: string; inviterId: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_reject', data)
  }

  /**
   * Join a study room page.
   */
  sendStudyRoomJoin(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_join', data)
  }

  /**
   * Leave a study room.
   */
  sendStudyRoomLeave(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_leave', data)
  }

  /**
   * End a study room (host only).
   */
  sendStudyRoomEnd(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_end', data)
  }

  /**
   * Start the Pomodoro timer.
   */
  sendTimerStart(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('timer_start', data)
  }

  /**
   * Pause the timer.
   */
  sendTimerPause(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('timer_pause', data)
  }

  /**
   * Resume the timer.
   */
  sendTimerResume(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('timer_resume', data)
  }

  /**
   * Skip the current timer phase.
   */
  sendTimerSkip(data: { roomCode: string }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('timer_skip', data)
  }

  /**
   * Send a chat message.
   */
  sendStudyRoomMessage(data: {
    roomCode: string
    content: string
    username: string
  }): void {
    if (!this.socket?.connected) {
      console.error('[CallSocket] Not connected')
      return
    }
    this.socket.emit('study_room_message', data)
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
