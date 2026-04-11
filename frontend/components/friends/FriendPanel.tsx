'use client'

import { useState, useEffect } from 'react'
import { useFriendStore } from '@/store/friendStore'
import { Button } from '@/components/ui/button'
import { CallButton } from '@/components/call/CallButton'
import { StudyRoomButton } from '@/components/study-room/StudyRoomButton'
import { SearchUsersDialog } from './SearchUsersDialog'
import type { FriendListResponse } from '@/types'

type Tab = 'friends' | 'requests' | 'search'

interface FriendPanelProps {
  onStudyRoomCreated?: (roomCode: string) => void
}

export function FriendPanel({ onStudyRoomCreated }: FriendPanelProps) {
  const {
    friends,
    pendingRequests,
    onlineFriendIds,
    isLoading,
    error,
    fetchFriends,
    fetchPendingRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    deleteFriend,
    clearError,
  } = useFriendStore()

  const [activeTab, setActiveTab] = useState<Tab>('friends')
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchFriends()
    fetchPendingRequests()
  }, [fetchFriends, fetchPendingRequests])

  const handleDeleteFriend = async (friendshipId: string) => {
    if (!confirm('确定要删除该好友吗？')) return
    setDeletingId(friendshipId)
    await deleteFriend(friendshipId)
    setDeletingId(null)
  }

  const renderFriendItem = (friend: FriendListResponse) => {
    const isOnline = onlineFriendIds.has(friend.id)
    return (
      <div
        key={friend.id}
        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="relative">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-300">
                {friend.username.charAt(0).toUpperCase()}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-700 ${
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{friend.username}</p>
              {friend.subject && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400 truncate">{friend.subject}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2 shrink-0">
            <CallButton
              userId={friend.id}
              username={friend.username}
              variant="icon"
              onCallInitiated={() => {}}
            />
            <StudyRoomButton
              userId={friend.id}
              username={friend.username}
              subject={friend.subject}
              variant="icon"
              onRoomCreated={onStudyRoomCreated || (() => {})}
            />
            <button
              onClick={() => handleDeleteFriend(friend.friendship_id)}
              disabled={deletingId === friend.friendship_id}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              title="删除好友"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderRequestItem = (request: typeof pendingRequests.received[0], type: 'sent' | 'received') => (
    <div
      key={request.id}
      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-white truncate">{request.friend.username}</p>
          {request.friend.subject && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 truncate">{request.friend.subject}</p>
          )}
        </div>
        {type === 'received' ? (
          <div className="flex items-center space-x-2 ml-2">
            <Button
              size="sm"
              onClick={() => acceptFriendRequest(request.id)}
            >
              接受
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectFriendRequest(request.id)}
            >
              拒绝
            </Button>
          </div>
        ) : (
          <span className="text-sm text-yellow-600 dark:text-yellow-400 ml-2">等待回复</span>
        )}
      </div>
    </div>
  )

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends', label: '好友' },
    { key: 'requests', label: '请求', badge: pendingRequests.received.length },
    { key: 'search', label: '搜索' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Error banner */}
      {error && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600">x</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'search') setShowSearchDialog(true)
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="absolute -top-1 right-1/4 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' && (
          <>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">暂无好友</p>
                <p className="text-sm">点击"搜索"标签添加好友</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(renderFriendItem)}
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <>
            {pendingRequests.received.length === 0 && pendingRequests.sent.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>暂无好友请求</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.received.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">收到的请求</h4>
                    <div className="space-y-2">
                      {pendingRequests.received.map((r) => renderRequestItem(r, 'received'))}
                    </div>
                  </div>
                )}
                {pendingRequests.sent.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">发送的请求</h4>
                    <div className="space-y-2">
                      {pendingRequests.sent.map((r) => renderRequestItem(r, 'sent'))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Search Dialog */}
      <SearchUsersDialog
        open={showSearchDialog}
        onClose={() => {
          setShowSearchDialog(false)
          setActiveTab('friends')
        }}
      />
    </div>
  )
}
