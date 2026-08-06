import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@features/auth/types/auth.types";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (token: string, refreshToken: string, user: AuthUser) => void;
  setSessionTokens: (token: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      setSessionTokens: (token, refreshToken) => set({ token, refreshToken }),
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: "auth-storage" },
  ),
);
