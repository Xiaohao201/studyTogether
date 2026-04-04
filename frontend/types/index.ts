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
