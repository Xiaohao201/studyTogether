// Map page - displays nearby learners on a map
'use client';

// Force dynamic rendering to prevent SSR prerendering
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { Button } from '../../components/ui/button';
import { useAuthStore, useLocationStore, useSessionStore, useCallStore } from '../../store';
import { CallButton } from '../../components/call/CallButton';
import { IncomingCallDialog } from '../../components/call/IncomingCallDialog';
import { getCallSocket } from '../../lib/callSocket';
import type { NearbyUser } from '../../types';

// Dynamically import StudyMap to prevent SSR issues with AMap
const StudyMap = dynamicImport(() => import('../../components/StudyMap').then(mod => ({ default: mod.StudyMap })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <p>正在加载地图...</p>
    </div>
  ),
});

export default function MapPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const {
    currentLocation,
    nearbyUsers,
    isTracking,
    startTracking,
    stopTracking,
    fetchNearbyUsers,
    isLoading,
  } = useLocationStore();
  const {
    activeSession,
    startSession,
    endSession,
    fetchActiveSession,
  } = useSessionStore();
  const { incomingCall, activeCall } = useCallStore();

  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [showIncomingCallDialog, setShowIncomingCallDialog] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Connect call socket and register event handlers on mount
  const socketInitialized = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || socketInitialized.current) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const callSocket = getCallSocket();
    callSocket.connect(token);

    callSocket.on({
      onIncomingCallOffer: (data) => {
        useCallStore.getState().setIncomingCall({
          callerId: data.callerId,
          roomCode: data.roomCode,
          callType: 'voice', // default; answerCall fetches real type from API
          offer: data,
        });
      },
      onCallAnswered: (data) => {
        useCallStore.getState().handleCallAnswered(data);
      },
      onIceCandidate: (data) => {
        useCallStore.getState().handleIceCandidate(data);
      },
      onCallEnded: (data) => {
        useCallStore.getState().handleCallEnded(data);
      },
      onCallRejected: (data) => {
        useCallStore.getState().handleCallRejected(data);
      },
      onCallUserUnavailable: (data) => {
        useCallStore.getState().handleUserUnavailable(data);
      },
    });

    socketInitialized.current = true;

    return () => {
      // Do NOT disconnect here — the call room page reuses the same singleton.
      // Cleanup is handled by callStore.cleanup() or explicit logout.
    };
  }, [isAuthenticated]);

  // Start location tracking when component mounts
  useEffect(() => {
    if (isAuthenticated && !isTracking) {
      startTracking();
    }
  }, [isAuthenticated, isTracking]);

  // Fetch nearby users when location updates
  useEffect(() => {
    if (currentLocation) {
      fetchNearbyUsers(currentLocation.latitude, currentLocation.longitude, 5);
    }
  }, [currentLocation]);

  // Fetch active session on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveSession();
    }
  }, [isAuthenticated]);

  // Show incoming call dialog when receiving a call
  useEffect(() => {
    if (incomingCall) {
      setShowIncomingCallDialog(true);
    }
  }, [incomingCall]);

  // Redirect to call room when call is active
  useEffect(() => {
    if (activeCall) {
      router.push(`/call/${activeCall.room_code}`);
    }
  }, [activeCall, router]);

  // Handle starting a session
  const handleStartSession = async () => {
    if (!subjectInput.trim()) {
      return;
    }
    try {
      await startSession(subjectInput);
      setShowSubjectDialog(false);
      setSubjectInput('');
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || '未知错误';
      console.error('Failed to start session:', detail);
      alert(`开始学习会话失败: ${detail}`);
    }
  };

  // Handle ending a session
  const handleEndSession = async () => {
    try {
      await endSession();
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const handleLogout = async () => {
    stopTracking();
    await logout();
    router.push('/');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              StudyTogether
            </h1>
            <div className="hidden md:block text-sm text-gray-600 dark:text-gray-400">
              {currentLocation ? (
                <span>📍 已获取位置 | {nearbyUsers.length} 位附近学习者</span>
              ) : (
                <span>📍 正在获取位置...</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400" data-testid="map-username">
              <span className="font-medium">{user.username}</span>
              {user.subject && <span className="ml-2">({user.subject})</span>}
            </div>
            <Button variant="outline" size="sm" data-testid="map-logout-btn" onClick={handleLogout}>
              退出
            </Button>
          </div>
        </div>
      </header>

      {/* Map and Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto" data-testid="map-sidebar">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">附近的学习伙伴</h2>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                正在搜索附近的学习者...
              </div>
            ) : nearbyUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">附近暂无正在学习的伙伴</p>
                <p className="text-sm">成为第一个在这个区域学习的人吧！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {nearbyUsers.map((nearbyUser) => (
                  <div
                    key={nearbyUser.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    onClick={() => setSelectedUser(nearbyUser)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {nearbyUser.username}
                        </h3>
                        {nearbyUser.subject && (
                          <p className="text-sm text-indigo-600 dark:text-indigo-400">
                            {nearbyUser.subject}
                          </p>
                        )}
                        <div className="mt-2">
                          <CallButton
                            userId={nearbyUser.id}
                            username={nearbyUser.username}
                            variant="icon"
                            onCallInitiated={() => {}}
                          />
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {nearbyUser.distance_meters < 1000
                            ? `${Math.round(nearbyUser.distance_meters)}m`
                            : `${(nearbyUser.distance_meters / 1000).toFixed(1)}km`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {nearbyUser.city || '未知位置'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1" data-testid="map-container">
          <StudyMap
            center={
              currentLocation
                ? [currentLocation.longitude, currentLocation.latitude]
                : [116.4074, 39.9042]
            }
            nearbyUsers={nearbyUsers}
            onMarkerClick={setSelectedUser}
          />
        </main>
      </div>

      {/* User Status Bar */}
      {currentLocation && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 dark:text-gray-400">
                状态: <span className={`font-medium ${activeSession ? 'text-green-600' : 'text-gray-600'}`}>
                  {activeSession ? '学习中' : '在线'}
                </span>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                位置: <span className="font-medium">已共享</span>
              </span>
              {activeSession && (
                <span className="text-gray-600 dark:text-gray-400">
                  学习: <span className="font-medium">{activeSession.subject}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {activeSession ? (
                <Button size="sm" variant="destructive" onClick={handleEndSession}>
                  结束学习
                </Button>
              ) : (
                <Button size="sm" onClick={() => setShowSubjectDialog(true)}>
                  开始学习会话
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subject Dialog */}
      {showSubjectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">开始学习会话</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              你要学习什么科目？
            </p>
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleStartSession()}
              placeholder="例如：Python编程、考研数学"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSubjectDialog(false);
                  setSubjectInput('');
                }}
              >
                取消
              </Button>
              <Button onClick={handleStartSession} disabled={!subjectInput.trim()}>
                开始学习
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Dialog */}
      <IncomingCallDialog
        open={showIncomingCallDialog}
        onOpenChange={setShowIncomingCallDialog}
        incomingCall={incomingCall}
      />
    </div>
  );
}
