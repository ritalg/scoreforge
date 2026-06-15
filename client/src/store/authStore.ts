import { create } from 'zustand';
import { api } from '../lib/api';
import { applyTheme, applyFontSize } from '../lib/theme';
import i18n from '../lib/i18n';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'parent' | 'tutor' | 'admin' | 'superadmin';
  theme: 'system' | 'light' | 'dark';
  language: string;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  totpEnabled: boolean;
  leaderboardOptOut: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresTOTP?: boolean }>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  login: async (email, password, totpCode) => {
    const data = await api.post<{ user?: User; token?: string; requiresTOTP?: boolean }>(
      '/api/auth/login',
      { email, password, totpCode }
    );

    if (data.requiresTOTP) return { requiresTOTP: true };

    if (data.user) {
      set({ user: data.user });
      applyTheme(data.user.theme);
      applyFontSize(data.user.fontSize);
      i18n.changeLanguage(data.user.language);
    }
    return {};
  },

  logout: async () => {
    await api.post('/api/auth/logout');
    set({ user: null });
  },

  fetchMe: async () => {
    try {
      const user = await api.get<User>('/api/auth/me');
      set({ user, loading: false });
      applyTheme(user.theme);
      applyFontSize(user.fontSize);
      i18n.changeLanguage(user.language);
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
