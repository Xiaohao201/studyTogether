// API client configuration and utilities
import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, AuthResponse, LoginCredentials, RegisterData, User } from '../types';

// API base URL from environment
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // SSR check
    if (typeof window === 'undefined') return config;

    const token = localStorage.getItem('access_token');
    console.log('[API Request]', config.method?.toUpperCase(), config.url, config.data);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('[API Request error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor: Handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // SSR check
    if (typeof window === 'undefined') return Promise.reject(error);

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;

          // Save new token
          localStorage.setItem('access_token', access_token);

          // Update header and retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (data: RegisterData): Promise<User> => {
    console.log('[API] POST /api/auth/register with data:', data);
    try {
      const response = await api.post<User>('/api/auth/register', data);
      console.log('[API] Registration response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Registration error:', error);
      throw error;
    }
  },

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    // Remove tokens from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/api/auth/me');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/api/auth/me', data);
    return response.data;
  },
};

// Users API
export const usersApi = {
  getPublicProfile: async (userId: string): Promise<User> => {
    const response = await api.get<ApiResponse<User>>(`/api/users/${userId}`);
    return response.data.data!;
  },
};

// Locations API
export const locationsApi = {
  createLocation: async (latitude: number, longitude: number) => {
    const response = await api.post('/api/locations/', { latitude, longitude });
    return response.data;
  },

  getMyLocation: async () => {
    const response = await api.get('/api/locations/me');
    return response.data;
  },

  findNearby: async (latitude: number, longitude: number, radiusKm: number = 5) => {
    const response = await api.get(
      `/api/locations/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`
    );
    return response.data;
  },

  deleteLocation: async () => {
    const response = await api.delete('/api/locations/');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/api/locations/stats');
    return response.data;
  },
};

// Sessions API
export const sessionsApi = {
  startSession: async (subject: string) => {
    const response = await api.post('/api/sessions/', { subject });
    return response.data;
  },

  endSession: async (sessionId: string) => {
    const response = await api.put(`/api/sessions/${sessionId}/end`);
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/api/sessions/${sessionId}`);
    return response.data;
  },

  getMySessions: async (limit: number = 50) => {
    const response = await api.get(`/api/sessions/?limit=${limit}`);
    return response.data;
  },

  getActiveSession: async () => {
    const response = await api.get('/api/sessions/active');
    return response.data;
  },
};

// Calls API
export const callsApi = {
  startCall: async (targetUserId: string, callType: 'voice' | 'video') => {
    const response = await api.post('/api/calls/start', {
      target_user_id: targetUserId,
      call_type: callType,
    });
    return response.data;
  },

  getCallRoom: async (roomCode: string) => {
    const response = await api.get(`/api/calls/${roomCode}`);
    return response.data;
  },

  endCall: async (roomId: string) => {
    const response = await api.post('/api/calls/end', { room_id: roomId });
    return response.data;
  },

  getMyActiveCalls: async () => {
    const response = await api.get('/api/calls/active/my-calls');
    return response.data;
  },
};

export default api;
