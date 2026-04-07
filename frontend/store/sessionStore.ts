// Session store using Zustand
import { create } from 'zustand';
import { sessionsApi, authApi } from '../lib/api';

interface Session {
  id: string;
  subject: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
}

interface SessionState {
  activeSession: Session | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startSession: (subject: string) => Promise<void>;
  endSession: () => Promise<void>;
  fetchActiveSession: () => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  isLoading: false,
  error: null,

  startSession: async (subject: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await sessionsApi.startSession(subject);
      set({ activeSession: session, isLoading: false });

      // Update user status in auth store
      const currentUser = await authApi.getCurrentUser();
      // Note: The backend already updates status, but we refresh to sync
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to start session',
        isLoading: false,
      });
      throw error;
    }
  },

  endSession: async () => {
    const { activeSession } = get();
    if (!activeSession) {
      set({ error: 'No active session to end' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const session = await sessionsApi.endSession(activeSession.id);
      set({ activeSession: null, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to end session',
        isLoading: false,
      });
      throw error;
    }
  },

  fetchActiveSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await sessionsApi.getActiveSession();
      set({ activeSession: session, isLoading: false });
    } catch (error: any) {
      // 404 is expected if no active session
      if (error.response?.status === 404) {
        set({ activeSession: null, isLoading: false });
      } else {
        set({
          error: error.response?.data?.detail || 'Failed to fetch active session',
          isLoading: false,
        });
      }
    }
  },

  clearError: () => set({ error: null }),
}));
