// User and Authentication Types
export interface User {
  id: string
  username: string
  email?: string
  subject?: string
  status: UserStatus
  study_duration_minutes: number
  privacy_mode: PrivacyMode
  show_exact_to_friends: boolean
  created_at: string
  updated_at: string
  last_seen_at: string
}

export type UserStatus = 'studying' | 'break' | 'offline'
export type PrivacyMode = 'exact' | 'fuzzy' | 'invisible'

// Location Types
export interface UserLocation {
  id: string
  user_id: string
  latitude: number
  longitude: string
  fuzzy_latitude?: number
  fuzzy_longitude?: number
  country_code?: string
  city?: string
  district?: string
  created_at: string
}

export interface LocationUpdate {
  latitude: number
  longitude: number
}

export interface NearbyUser extends User {
  distance_meters: number
  city?: string
  location: {
    latitude: number
    longitude: number
  }
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface UpdateUserData {
  username?: string
  subject?: string
  status?: UserStatus
  privacy_mode?: PrivacyMode
  show_exact_to_friends?: boolean
}

// Study Session Types
export interface StudySession {
  id: string
  user_id: string
  subject: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  participants_count: number
}

// Socket Event Types
export interface SocketLocationUpdate {
  latitude: number
  longitude: number
  subject?: string
  status?: UserStatus
}

export interface SocketNearbyUsers {
  users: NearbyUser[]
}

export interface SocketUserUpdated {
  user: User
}

export interface SocketUserEntered {
  user: NearbyUser
}

export interface SocketUserLeft {
  user_id: string
}

// Form Types
export interface LocationFormData {
  latitude: number
  longitude: number
}

export interface ProfileFormData {
  username: string
  subject: string
  privacy_mode: PrivacyMode
  show_exact_to_friends: boolean
}

// Call Types
export type CallType = 'voice' | 'video'
export type CallStatus = 'initiated' | 'ongoing' | 'ended' | 'rejected'

export interface CallRoom {
  id: string
  room_code: string
  host_id: string
  call_type: CallType
  call_status: CallStatus
  study_session_id?: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  participants: CallParticipant[]
}

export interface CallParticipant {
  id: string
  call_room_id: string
  user_id: string
  joined_at: string
  left_at?: string
  has_video: boolean
  has_audio: boolean
}

export interface CallRoomCreate {
  target_user_id: string
  call_type: CallType
}

export interface CallRoomResponse extends CallRoom {}

export interface CallEnd {
  room_id: string
}

// WebRTC Signaling Types
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback'
  sdp: string | null
}

export interface RTCIceCandidateInit {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
  usernameFragment: string | null
}

export interface CallOfferData {
  targetUserId: string
  roomCode: string
  offer: RTCSessionDescriptionInit
}

export interface CallAnswerData {
  callerId: string
  roomCode: string
  answer: RTCSessionDescriptionInit
}

export interface IceCandidateData {
  targetUserId: string
  candidate: RTCIceCandidateInit
}

export interface IncomingCallOfferData {
  callerId: string
  roomCode: string
  offer: RTCSessionDescriptionInit
}

export interface CallAnsweredData {
  calleeId: string
  roomCode: string
  answer: RTCSessionDescriptionInit
}

export interface IceCandidateReceivedData {
  senderId: string
  candidate: RTCIceCandidateInit
}

export interface CallRejectedData {
  calleeId: string
  roomCode: string
}

export interface CallEndedData {
  roomCode: string
  endedBy: string
}

export interface ParticipantMediaChangedData {
  userId: string
  hasAudio: boolean
  hasVideo: boolean
}

// Study Room Types
export type StudyRoomStatus = 'waiting' | 'active' | 'ended'
export type TimerPhase = 'focus' | 'break'

export interface StudyRoom {
  id: string
  room_code: string
  host_id: string
  subject: string | null
  room_status: StudyRoomStatus
  focus_duration: number
  break_duration: number
  started_at: string | null
  ended_at: string | null
  created_at: string
  participants: StudyRoomParticipantResponse[]
}

export interface StudyRoomParticipantResponse {
  id: string
  study_room_id: string
  user_id: string
  username: string | null
  joined_at: string
  left_at: string | null
}

export interface StudyRoomMessageResponse {
  id: string
  study_room_id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
}

export interface StudyRoomCreate {
  target_user_id: string
  subject?: string | null
  focus_duration?: number
  break_duration?: number
}

export interface StudyRoomEnd {
  room_code: string
}

export interface TimerState {
  roomCode: string
  phase: TimerPhase
  remainingSeconds: number
  isPaused: boolean
  phaseChangedAt: string
}

export interface IncomingStudyInvite {
  inviterId: string
  inviterUsername: string
  roomCode: string
  subject: string | null
}

export interface StudyInviteAccepted {
  roomCode: string
  accepterId: string
}

export interface StudyInviteRejected {
  roomCode: string
  rejecterId: string
}

export interface StudyRoomJoined {
  roomCode: string
}

export interface StudyRoomLeft {
  roomCode: string
  userId: string
}

export interface StudyRoomEnded {
  roomCode: string
  endedBy: string
}

export interface TimerPhaseChanged {
  roomCode: string
  phase: TimerPhase
  remainingSeconds: number
}

export interface StudyRoomMessageData {
  roomCode: string
  userId: string
  username: string
  content: string
  createdAt: string
}
