// Authentication store using Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi, setInitializing } from '../lib/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

// Concurrency guard: ensures initialize() runs only once even when
// called from multiple pages simultaneously (React 18 strict mode, etc.)
let initPromise: Promise<void> | null = null;

// Create SSR-safe storage for Zustand persist
const ssrSafeStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    try {
      const value = window.localStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Silent fail for SSR or private browsing mode
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Silent fail for SSR or private browsing mode
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });

          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
          }

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await authApi.register({ username, email, password });
          set({
            user,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || error.message || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          // Ignore logout API errors
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      initialize: async () => {
        const state = get();

        // Already initialized
        if (state.isHydrated) return;

        // Concurrency guard: reuse in-flight promise
        if (initPromise) return initPromise;

        initPromise = (async () => {
          const currentState = get();

          // No persisted token — nothing to validate
          if (!currentState.accessToken) {
            set({ isHydrated: true });
            return;
          }

          // Sync persisted token to localStorage so the Axios request interceptor
          // can find it when making the validation request
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', currentState.accessToken);
            if (currentState.refreshToken) {
              localStorage.setItem('refresh_token', currentState.refreshToken);
            }
          }

          // Suppress hard redirect during init so we can handle failure gracefully
          setInitializing(true);

          // Validate token by fetching current user.
          // The Axios response interceptor handles token refresh on 401 automatically.
          try {
            const user = await authApi.getCurrentUser();
            set({ user, isHydrated: true, isAuthenticated: true });
          } catch {
            // Either the access token was invalid AND the refresh also failed
            // (interceptor handles refresh). Clean up local state.
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isHydrated: true,
            });
          } finally {
            setInitializing(false);
          }
        })();

        initPromise.finally(() => {
          initPromise = null;
        });

        return initPromise;
      },

      refreshUser: async () => {
        try {
          const user = await authApi.getCurrentUser();
          set({ user });
        } catch (error) {
          // Silent fail
        }
      },

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null });
        try {
          const updatedUser = await authApi.updateProfile(data);
          set({ user: updatedUser, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Update failed',
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: ssrSafeStorage,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
