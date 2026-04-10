import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

const stored = localStorage.getItem('hotel_user');

export const useAuthStore = create<AuthState>((set) => ({
  user: stored ? JSON.parse(stored) : null,
  setUser: (user) => {
    localStorage.setItem('hotel_user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('hotel_user');
    set({ user: null });
  },
}));