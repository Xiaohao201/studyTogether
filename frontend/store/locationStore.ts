// Location store using Zustand
import { create } from 'zustand';
import type { NearbyUser } from '../types';
import { locationsApi } from '../lib/api';

interface LocationState {
  currentLocation: { latitude: number; longitude: number } | null;
  nearbyUsers: NearbyUser[];
  isTracking: boolean;
  isLoading: boolean;
  error: string | null;
  _watchId: number | null;

  // Actions
  startTracking: () => void;
  stopTracking: () => void;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  fetchNearbyUsers: (latitude: number, longitude: number, radiusKm?: number) => Promise<void>;
  clearLocation: () => Promise<void>;
  clearError: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  nearbyUsers: [],
  isTracking: false,
  isLoading: false,
  error: null,
  _watchId: null,

  startTracking: () => {
    set({ isTracking: true });

    // SSR check and Geolocation API availability
    if (typeof window === 'undefined' || !navigator.geolocation) {
      set({ error: 'Geolocation is not supported by your browser' });
      return;
    }

    // Clear any existing watcher first
    const existingWatchId = get()._watchId;
    if (existingWatchId !== null) {
      navigator.geolocation.clearWatch(existingWatchId);
    }

    // Watch position changes
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        set({ currentLocation: { latitude, longitude } });

        // Automatically update location on server
        get().updateLocation(latitude, longitude);
      },
      (error) => {
        set({ error: error.message });
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
    set({ _watchId: watchId });
  },

  stopTracking: () => {
    const watchId = get()._watchId;
    if (watchId !== null && typeof window !== 'undefined') {
      navigator.geolocation.clearWatch(watchId);
    }
    set({ isTracking: false, _watchId: null });
  },

  updateLocation: async (latitude: number, longitude: number) => {
    try {
      await locationsApi.createLocation(latitude, longitude);
    } catch (error: any) {
      console.error('Failed to update location:', error);
      // Don't set error state to avoid spamming user with errors
    }
  },

  fetchNearbyUsers: async (latitude: number, longitude: number, radiusKm: number = 5) => {
    set({ isLoading: true, error: null });
    try {
      const users = await locationsApi.findNearby(latitude, longitude, radiusKm);
      set({ nearbyUsers: users, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch nearby users',
        isLoading: false,
      });
    }
  },

  clearLocation: async () => {
    try {
      await locationsApi.deleteLocation();
      set({ currentLocation: null, nearbyUsers: [] });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to clear location' });
    }
  },

  clearError: () => set({ error: null }),
}));
