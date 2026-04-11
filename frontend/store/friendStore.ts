/**
 * Friend store — Zustand state management for friend features.
 *
 * Manages: friend list, pending requests, search, online status.
 */

import { create } from 'zustand'
import { friendsApi } from '@/lib/api'
import { getCallSocket } from '@/lib/callSocket'
import type {
  FriendListResponse,
  FriendRequestsResponse,
  FriendshipResponse,
  FriendStatusChangeData,
  FriendRequestReceivedData,
  FriendRequestAcceptedData,
  PublicUserResponse,
} from '@/types'

interface FriendState {
  friends: FriendListResponse[]
  pendingRequests: FriendRequestsResponse
  searchResults: PublicUserResponse[]
  onlineFriendIds: Set<string>
  isLoading: boolean
  error: string | null

  // Actions
  fetchFriends: () => Promise<void>
  fetchPendingRequests: () => Promise<void>
  sendFriendRequest: (addresseeId: string) => Promise<void>
  acceptFriendRequest: (friendshipId: string) => Promise<void>
  rejectFriendRequest: (friendshipId: string) => Promise<void>
  deleteFriend: (friendshipId: string) => Promise<void>
  searchUsers: (query: string) => Promise<void>
  clearSearchResults: () => void
  clearError: () => void

  // Socket event handlers
  handleFriendRequestReceived: (data: FriendRequestReceivedData) => void
  handleFriendRequestAccepted: (data: FriendRequestAcceptedData) => void
  handleFriendStatusChange: (data: FriendStatusChangeData) => void
  registerSocketHandlers: () => void

  // Computed helpers
  getPendingReceivedCount: () => number
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: { sent: [], received: [] },
  searchResults: [],
  onlineFriendIds: new Set<string>(),
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    try {
      set({ isLoading: true, error: null })
      const data: FriendListResponse[] = await friendsApi.getFriends()
      set({
        friends: data,
        onlineFriendIds: new Set(data.filter((f) => f.is_online).map((f) => f.id)),
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error?.response?.data?.detail || 'Failed to fetch friends',
        isLoading: false,
      })
    }
  },

  fetchPendingRequests: async () => {
    try {
      set({ error: null })
      const data: FriendRequestsResponse = await friendsApi.getPendingRequests()
      set({ pendingRequests: data })
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Failed to fetch requests' })
    }
  },

  sendFriendRequest: async (addresseeId: string) => {
    try {
      set({ error: null })
      const friendship: FriendshipResponse = await friendsApi.sendFriendRequest(addresseeId)
      set((state) => ({
        pendingRequests: {
          ...state.pendingRequests,
          sent: [...state.pendingRequests.sent, friendship],
        },
        searchResults: state.searchResults.filter((u) => u.id !== addresseeId),
      }))
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Failed to send request' })
      throw error
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    try {
      set({ error: null })
      await friendsApi.acceptFriendRequest(friendshipId)
      // Refresh both lists
      await get().fetchFriends()
      await get().fetchPendingRequests()
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Failed to accept request' })
    }
  },

  rejectFriendRequest: async (friendshipId: string) => {
    try {
      set({ error: null })
      await friendsApi.rejectFriendRequest(friendshipId)
      set((state) => ({
        pendingRequests: {
          sent: state.pendingRequests.sent,
          received: state.pendingRequests.received.filter((r) => r.id !== friendshipId),
        },
      }))
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Failed to reject request' })
    }
  },

  deleteFriend: async (friendshipId: string) => {
    try {
      set({ error: null })
      await friendsApi.deleteFriend(friendshipId)
      set((state) => ({
        friends: state.friends.filter((f) => f.friendship_id !== friendshipId),
      }))
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Failed to remove friend' })
    }
  },

  searchUsers: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }
    try {
      set({ error: null })
      const data: PublicUserResponse[] = await friendsApi.searchUsers(query)
      set({ searchResults: data })
    } catch (error: any) {
      set({ error: error?.response?.data?.detail || 'Search failed' })
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),
  clearError: () => set({ error: null }),

  // Socket event handlers
  handleFriendRequestReceived: (data: FriendRequestReceivedData) => {
    set((state) => ({
      pendingRequests: {
        ...state.pendingRequests,
        received: [
          ...state.pendingRequests.received,
          {
            id: data.friendship_id,
            requester_id: '',
            addressee_id: '',
            status: 'pending' as const,
            created_at: data.created_at,
            updated_at: data.created_at,
            friend: data.friend,
          },
        ],
      },
    }))
  },

  handleFriendRequestAccepted: (data: FriendRequestAcceptedData) => {
    // Refresh friend list and pending requests
    get().fetchFriends()
    get().fetchPendingRequests()
  },

  handleFriendStatusChange: (data: FriendStatusChangeData) => {
    if (data.onlineFriendIds) {
      // Initial batch of online friend IDs on connect
      set({ onlineFriendIds: new Set(data.onlineFriendIds) })
    } else if (data.userId && data.isOnline !== undefined) {
      set((state) => {
        const next = new Set(state.onlineFriendIds)
        if (data.isOnline) {
          next.add(data.userId!)
        } else {
          next.delete(data.userId!)
        }
        return { onlineFriendIds: next }
      })
    }
  },

  registerSocketHandlers: () => {
    const socket = getCallSocket()
    socket.on({
      onFriendRequestReceived: (data) => get().handleFriendRequestReceived(data),
      onFriendRequestAccepted: (data) => get().handleFriendRequestAccepted(data),
      onFriendStatusChange: (data) => get().handleFriendStatusChange(data),
    })
  },

  getPendingReceivedCount: () => get().pendingRequests.received.length,
}))
