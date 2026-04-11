'use client'

import { useState, useRef, useEffect } from 'react'
import { useFriendStore } from '@/store/friendStore'
import { Button } from '@/components/ui/button'
import type { PublicUserResponse } from '@/types'

interface SearchUsersDialogProps {
  open: boolean
  onClose: () => void
}

export function SearchUsersDialog({ open, onClose }: SearchUsersDialogProps) {
  const { searchResults, searchUsers, sendFriendRequest, clearSearchResults, pendingRequests, friends } = useFriendStore()
  const [query, setQuery] = useState('')
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
    if (!open) {
      setQuery('')
      clearSearchResults()
    }
  }, [open, clearSearchResults])

  const handleSearch = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchUsers(value)
    }, 300)
  }

  const handleSendRequest = async (userId: string) => {
    try {
      setSendingTo(userId)
      await sendFriendRequest(userId)
    } catch {
      // Error handled in store
    } finally {
      setSendingTo(null)
    }
  }

  const getRequestStatus = (user: PublicUserResponse): 'none' | 'sent' | 'friend' => {
    const isFriend = friends.some((f) => f.id === user.id)
    if (isFriend) return 'friend'
    const isSent = pendingRequests.sent.some((r) => r.friend.id === user.id)
    if (isSent) return 'sent'
    return 'none'
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 sm:p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">搜索用户</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="输入用户名或邮箱..."
          className="w-full min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white mb-4"
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {query && searchResults.length === 0 && (
            <p className="text-center text-gray-500 py-4">未找到用户</p>
          )}
          {!query && (
            <p className="text-center text-gray-500 py-4">输入关键词搜索用户</p>
          )}
          {searchResults.map((user) => {
            const status = getRequestStatus(user)
            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{user.username}</p>
                  {user.subject && (
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">{user.subject}</p>
                  )}
                </div>
                <div>
                  {status === 'friend' && (
                    <span className="text-sm text-green-600 dark:text-green-400">已是好友</span>
                  )}
                  {status === 'sent' && (
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">已发送</span>
                  )}
                  {status === 'none' && (
                    <Button
                      size="sm"
                      disabled={sendingTo === user.id}
                      onClick={() => handleSendRequest(user.id)}
                    >
                      {sendingTo === user.id ? '发送中...' : '添加好友'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
