// Location store using Zustand
import { create } from 'zustand';
import type { NearbyUser } from '@/types';
import { locationsApi } from '@/lib/api';

interface LocationState {
  currentLocation: { latitude: number; longitude: number } | null;
  nearbyUsers: NearbyUser[];
  isTracking: boolean;
  isLoading: boolean;
  error: string | null;

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

  startTracking: () => {
    set({ isTracking: true });

    // Check if Geolocation API is available
    if (!navigator.geolocation) {
      set({ error: 'Geolocation is not supported by your browser' });
      return;
    }

    // Watch position changes
    navigator.geolocation.watchPosition(
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
  },

  stopTracking: () => {
    set({ isTracking: false });
    // Note: Geolocation watchPosition will continue running
    // To fully stop, you need to save the watchId and call navigator.geolocation.clearWatch(watchId)
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
