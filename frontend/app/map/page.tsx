// Map page - displays nearby learners on a map
'use client';

// Force dynamic rendering to prevent SSR prerendering
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '../../components/ui/button';
import { useAuthStore, useLocationStore } from '../../store';
import type { NearbyUser } from '../../types';

// Dynamically import StudyMap to prevent SSR issues with AMap
const StudyMap = dynamic(() => import('../../components/StudyMap').then(mod => ({ default: mod.StudyMap })), {
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

  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {nearbyUser.username}
                        </h3>
                        {nearbyUser.subject && (
                          <p className="text-sm text-indigo-600 dark:text-indigo-400">
                            {nearbyUser.subject}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
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
                状态: <span className="font-medium text-green-600">在线</span>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                位置: <span className="font-medium">已共享</span>
              </span>
              {user.subject && (
                <span className="text-gray-600 dark:text-gray-400">
                  学习: <span className="font-medium">{user.subject}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline">
                更新状态
              </Button>
              <Button size="sm">
                开始学习会话
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
