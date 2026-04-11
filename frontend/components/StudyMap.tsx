// AMap (Gaode Map) component with user markers
'use client';

import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import type { NearbyUser } from '../types';
import { useLocationStore } from '../store';

// AMap security configuration
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '';
const AMAP_SECRET = process.env.NEXT_PUBLIC_AMAP_SECRET || '';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface StudyMapProps {
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  nearbyUsers?: NearbyUser[];
  onMarkerClick?: (user: NearbyUser) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export function StudyMap({
  center = [116.4074, 39.9042], // Beijing default
  zoom = 12,
  nearbyUsers = [],
  onMarkerClick,
  userLocation,
}: StudyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const userInfoWindowRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centeredOnUser, setCenteredOnUser] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    if (!AMAP_KEY) {
      setError('AMAP_KEY 未配置');
      return;
    }

    // Set security code (required by AMap)
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECRET,
    };

    AMapLoader.load({
      key: AMAP_KEY,
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.ControlBar'],
    })
      .then((AMap: any) => {
        try {
          const map = new AMap.Map(mapContainer.current, {
            zoom: zoom,
            center: center,
            mapStyle: 'amap://styles/normal',
            viewMode: '3D',
          });

          // Add controls
          map.addControl(new AMap.Scale());
          map.addControl(new AMap.ToolBar());
          map.addControl(new AMap.ControlBar({
            position: {
              top: '110px',
              right: '10px',
            },
          }));

          mapInstance.current = map;
          setMapLoaded(true);
        } catch (err) {
          setError('地图初始化失败');
        }
      })
      .catch((err: any) => {
        setError('高德地图加载失败，请检查密钥配置');
      });

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []);

  // Auto-center map when user location first becomes available
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || !userLocation) return;

    if (!centeredOnUser) {
      const newCenter: [number, number] = [userLocation.longitude, userLocation.latitude];
      // First time: smooth animation to user's location with street-level zoom
      mapInstance.current.setZoomAndCenter(15, newCenter, false, 600);
      setCenteredOnUser(true);
    }
  }, [userLocation, mapLoaded, centeredOnUser]);

  // Re-center on user handler
  const handleRecenter = () => {
    if (!mapInstance.current || !userLocation) return;
    const pos: [number, number] = [userLocation.longitude, userLocation.latitude];
    mapInstance.current.setZoomAndCenter(15, pos, false, 600);
  };

  // Update markers when nearbyUsers change
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    nearbyUsers.forEach((user) => {
      // Create custom marker content
      const content = `
        <div class="custom-marker" style="cursor: pointer;">
          <div style="width: 44px; height: 44px; background-color: #4f46e5; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;">
            <svg style="width: 24px; height: 24px; color: white;" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      `;

      // Create marker
      const marker = new (window as any).AMap.Marker({
        position: [user.location.longitude, user.location.latitude],
        content: content,
        offset: new (window as any).AMap.Pixel(-22, -44),
        title: user.username,
      });

      // Create info window
      const distanceText = user.distance_meters < 1000
        ? `${Math.round(user.distance_meters)}m`
        : `${(user.distance_meters / 1000).toFixed(1)}km`;

      const infoWindow = new (window as any).AMap.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 180px; max-width: 280px;">
            <h3 style="font-weight: bold; font-size: 16px; margin: 0 0 8px 0;">${escapeHtml(user.username)}</h3>
            <p style="font-size: 14px; color: #666; margin: 4px 0;">${user.subject ? escapeHtml(user.subject) : '未设置科目'}</p>
            <p style="font-size: 14px; color: #999; margin: 4px 0;">距离: ${distanceText}</p>
            ${user.city ? `<p style="font-size: 12px; color: #999; margin: 4px 0;">${escapeHtml(user.city)}</p>` : ''}
          </div>
        `,
        offset: new (window as any).AMap.Pixel(0, -44),
      });

      // Add click handler
      marker.on('click', () => {
        infoWindow.open(mapInstance.current, marker.getPosition());
        if (onMarkerClick) {
          onMarkerClick(user);
        }
      });

      marker.setMap(mapInstance.current);
      markersRef.current.push(marker);
    });
  }, [nearbyUsers, mapLoaded, onMarkerClick]);

  // Update user's own location marker — reacts to location changes
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    const loc = userLocation ?? useLocationStore.getState().currentLocation;
    if (!loc) return;

    // Remove previous user marker and infoWindow
    if (userMarkerRef.current) {
      userInfoWindowRef.current?.close();
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
      userInfoWindowRef.current = null;
    }

    const content = `
      <div class="user-marker">
        <div style="width: 36px; height: 36px; background-color: #22c55e; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;">
          <svg style="width: 18px; height: 18px; color: white;" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    `;

    const marker = new (window as any).AMap.Marker({
      position: [loc.longitude, loc.latitude],
      content: content,
      offset: new (window as any).AMap.Pixel(-18, -36),
      title: '你的位置',
      zIndex: 999,
    });

    const infoWindow = new (window as any).AMap.InfoWindow({
      content: '<div style="padding: 8px;"><p style="font-weight: bold; margin: 0;">你的位置</p></div>',
      offset: new (window as any).AMap.Pixel(0, -36),
    });

    marker.on('click', () => {
      infoWindow.open(mapInstance.current, marker.getPosition());
    });

    marker.setMap(mapInstance.current);
    userMarkerRef.current = marker;
    userInfoWindowRef.current = infoWindow;
  }, [mapLoaded, userLocation]);

  return (
    <div className="relative w-full h-full">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="text-center p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold text-red-600 mb-2">高德地图配置错误</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {error}
            </p>
            <p className="text-xs text-gray-500 mb-2">请在 .env.local 文件中配置以下环境变量：</p>
            <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded block">
              NEXT_PUBLIC_AMAP_KEY=your_key_here<br />
              NEXT_PUBLIC_AMAP_SECRET=your_secret_here
            </code>
            <p className="text-xs text-gray-500 mt-4">
              访问 <a href="https://console.amap.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">高德开放平台</a> 获取密钥
            </p>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full amap-container" />

      {/* Re-center on me button */}
      {mapLoaded && userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-6 right-3 z-20 w-11 h-11 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-transform border border-gray-200 dark:border-gray-600"
          title="回到我的位置"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}
