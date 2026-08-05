"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, tokens } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  unreadNotifications: number;
  unreadMessages: number;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  setCounts: (counts: { notifications?: number; messages?: number }) => void;
  applyAuthResponse: (payload: { accessToken: string; refreshToken: string; user: User }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    email: null,
    loading: true,
    unreadNotifications: 0,
    unreadMessages: 0,
  });

  const refreshUser = useCallback(async () => {
    if (!tokens.access() && !tokens.refresh()) {
      setState((s) => ({ ...s, user: null, email: null, loading: false }));
      return;
    }
    try {
      const data = await api.get<{ user: User; email: string; unreadNotifications: number }>(
        "/auth/me",
      );
      setState((s) => ({
        ...s,
        user: data.user,
        email: data.email,
        unreadNotifications: data.unreadNotifications,
        loading: false,
      }));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) tokens.clear();
      setState((s) => ({ ...s, user: null, email: null, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Başka bir sekmede çıkış yapılırsa burayı da senkronla.
  useEffect(() => {
    const handler = () => {
      if (!tokens.access()) setState((s) => ({ ...s, user: null }));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const applyAuthResponse = useCallback(
    (payload: { accessToken: string; refreshToken: string; user: User }) => {
      tokens.set(payload.accessToken, payload.refreshToken);
      setState((s) => ({ ...s, user: payload.user, loading: false }));
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { email, password },
        { auth: false },
      );
      applyAuthResponse(data);
      await refreshUser();
    },
    [applyAuthResponse, refreshUser],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokens.refresh();
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // çıkış her durumda yerelde tamamlanır
    }
    tokens.clear();
    setState({ user: null, email: null, loading: false, unreadNotifications: 0, unreadMessages: 0 });
    router.push("/giris");
  }, [router]);

  const setUser = useCallback((user: User) => setState((s) => ({ ...s, user })), []);

  const setCounts = useCallback(
    (counts: { notifications?: number; messages?: number }) =>
      setState((s) => ({
        ...s,
        unreadNotifications: counts.notifications ?? s.unreadNotifications,
        unreadMessages: counts.messages ?? s.unreadMessages,
      })),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, refreshUser, setUser, setCounts, applyAuthResponse }),
    [state, login, logout, refreshUser, setUser, setCounts, applyAuthResponse],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  return context;
}

/** Oturum zorunlu sayfalar için: giriş yoksa /giris'e yönlendirir. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      const next = typeof window !== "undefined" ? window.location.pathname : "/";
      router.replace(`/giris?next=${encodeURIComponent(next)}`);
    }
  }, [auth.loading, auth.user, router]);

  return auth;
}
