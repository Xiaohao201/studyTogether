// Study room store using Zustand
import { create } from 'zustand'
import { studyRoomsApi } from '@/lib/api'
import { getCallSocket } from '@/lib/callSocket'
import type {
  StudyRoom,
  StudyRoomMessageResponse,
  TimerState,
  TimerPhase,
  IncomingStudyInvite,
  StudyInviteAccepted,
  StudyRoomLeft,
  StudyRoomEnded,
  StudyRoomMessageData,
} from '@/types'

interface StudyRoomState {
  // Room state
  currentRoom: StudyRoom | null
  isHost: boolean
  isLoading: boolean
  error: string | null

  // Timer state
  timerState: TimerState | null

  // Chat state
  messages: StudyRoomMessageResponse[]
  messagesLoaded: boolean

  // Incoming invites
  incomingInvite: IncomingStudyInvite | null

  // Actions - Room
  createRoom: (targetUserId: string, subject?: string | null, focusDuration?: number, breakDuration?: number) => Promise<StudyRoom | null>
  fetchRoom: (roomCode: string) => Promise<void>
  endRoom: () => Promise<void>
  leaveRoom: () => Promise<void>

  // Actions - Invite
  setIncomingInvite: (invite: IncomingStudyInvite | null) => void
  acceptInvite: (invite: IncomingStudyInvite) => Promise<void>
  rejectInvite: (invite: IncomingStudyInvite) => void

  // Actions - Timer
  startTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
  skipPhase: () => void
  handleTimerState: (state: TimerState) => void
  handleTimerPhaseChanged: (data: { roomCode: string; phase: TimerPhase; remainingSeconds: number }) => void

  // Actions - Chat
  fetchMessages: (roomCode: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  handleIncomingMessage: (data: StudyRoomMessageData) => void

  // Actions - Socket event handlers
  handleInviteAccepted: (data: StudyInviteAccepted) => Promise<void>
  handleInviteRejected: () => void
  handleParticipantLeft: (data: StudyRoomLeft) => void
  handleRoomEnded: (data: StudyRoomEnded) => void

  // Actions - Cleanup
  cleanup: () => void
  clearError: () => void
}

export const useStudyRoomStore = create<StudyRoomState>((set, get) => ({
  // Initial state
  currentRoom: null,
  isHost: false,
  isLoading: false,
  error: null,
  timerState: null,
  messages: [],
  messagesLoaded: false,
  incomingInvite: null,

  createRoom: async (targetUserId, subject, focusDuration, breakDuration) => {
    set({ isLoading: true, error: null })
    try {
      const room = await studyRoomsApi.startStudyRoom({
        target_user_id: targetUserId,
        subject: subject ?? null,
        focus_duration: focusDuration,
        break_duration: breakDuration,
      })

      // Send invite via socket
      const callSocket = getCallSocket()
      const { useAuthStore } = await import('./authStore')
      const username = useAuthStore.getState().user?.username ?? ''

      callSocket.sendStudyRoomInvite({
        targetUserId,
        roomCode: room.room_code,
        subject: room.subject,
        inviterUsername: username,
      })

      set({
        currentRoom: room,
        isHost: true,
        isLoading: false,
      })

      return room
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to create study room',
        isLoading: false,
      })
      return null
    }
  },

  fetchRoom: async (roomCode: string) => {
    set({ isLoading: true, error: null })
    try {
      const room = await studyRoomsApi.getStudyRoom(roomCode)
      const { useAuthStore } = await import('./authStore')
      const userId = useAuthStore.getState().user?.id
      const host = String(room.host_id) === userId

      set({
        currentRoom: room,
        isHost: host,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch study room',
        isLoading: false,
      })
    }
  },

  endRoom: async () => {
    const { currentRoom } = get()
    if (!currentRoom) return

    try {
      const callSocket = getCallSocket()
      callSocket.sendStudyRoomEnd({ roomCode: currentRoom.room_code })

      await studyRoomsApi.endStudyRoom(currentRoom.room_code)
      get().cleanup()
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to end study room' })
    }
  },

  leaveRoom: async () => {
    const { currentRoom } = get()
    if (!currentRoom) return

    try {
      const callSocket = getCallSocket()
      callSocket.sendStudyRoomLeave({ roomCode: currentRoom.room_code })

      await studyRoomsApi.leaveStudyRoom(currentRoom.room_code)
      get().cleanup()
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to leave study room' })
    }
  },

  setIncomingInvite: (invite) => set({ incomingInvite: invite }),

  acceptInvite: async (invite) => {
    const callSocket = getCallSocket()
    callSocket.sendStudyRoomAccept({
      roomCode: invite.roomCode,
      inviterId: invite.inviterId,
    })
    set({ incomingInvite: null })
  },

  rejectInvite: (invite) => {
    const callSocket = getCallSocket()
    callSocket.sendStudyRoomReject({
      roomCode: invite.roomCode,
      inviterId: invite.inviterId,
    })
    set({ incomingInvite: null })
  },

  startTimer: () => {
    const { currentRoom } = get()
    if (!currentRoom) return
    const callSocket = getCallSocket()
    callSocket.sendTimerStart({ roomCode: currentRoom.room_code })
  },

  pauseTimer: () => {
    const { currentRoom } = get()
    if (!currentRoom) return
    const callSocket = getCallSocket()
    callSocket.sendTimerPause({ roomCode: currentRoom.room_code })
  },

  resumeTimer: () => {
    const { currentRoom } = get()
    if (!currentRoom) return
    const callSocket = getCallSocket()
    callSocket.sendTimerResume({ roomCode: currentRoom.room_code })
  },

  skipPhase: () => {
    const { currentRoom } = get()
    if (!currentRoom) return
    const callSocket = getCallSocket()
    callSocket.sendTimerSkip({ roomCode: currentRoom.room_code })
  },

  handleTimerState: (state) => {
    set({ timerState: state })
  },

  handleTimerPhaseChanged: (data) => {
    const { timerState } = get()
    if (timerState) {
      set({
        timerState: {
          ...timerState,
          phase: data.phase,
          remainingSeconds: data.remainingSeconds,
        }
      })
    }
  },

  fetchMessages: async (roomCode) => {
    try {
      const messages = await studyRoomsApi.getMessages(roomCode)
      set({ messages, messagesLoaded: true })
    } catch (error) {
      // silently fail - chat history is non-critical
    }
  },

  sendMessage: async (content) => {
    const { currentRoom } = get()
    if (!currentRoom || !content.trim()) return

    const { useAuthStore } = await import('./authStore')
    const username = useAuthStore.getState().user?.username ?? ''

    const callSocket = getCallSocket()
    callSocket.sendStudyRoomMessage({
      roomCode: currentRoom.room_code,
      content: content.trim(),
      username,
    })
  },

  handleIncomingMessage: (data) => {
    const { messages } = get()
    set({
      messages: [
        ...messages,
        {
          id: `${data.userId}-${data.createdAt}`,
          study_room_id: data.roomCode,
          user_id: data.userId,
          username: data.username,
          content: data.content,
          created_at: data.createdAt,
        },
      ]
    })
  },

  handleInviteAccepted: async (data) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.room_code === data.roomCode) {
      // Refresh room data
      await get().fetchRoom(data.roomCode)
    }
  },

  handleInviteRejected: () => {
    // Host's invite was rejected
    set({ error: '学习邀请被拒绝' })
  },

  handleParticipantLeft: (data) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.room_code === data.roomCode) {
      set({
        currentRoom: {
          ...currentRoom,
          participants: currentRoom.participants.filter(
            (p) => p.user_id !== data.userId
          ),
        }
      })
    }
  },

  handleRoomEnded: () => {
    get().cleanup()
  },

  cleanup: () => {
    set({
      currentRoom: null,
      isHost: false,
      timerState: null,
      messages: [],
      messagesLoaded: false,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
}))
