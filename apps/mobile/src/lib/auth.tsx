import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, tokens } from "./api";
import { disconnectSocket } from "./socket";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  email: string | null;
  loading: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  setCounts: (counts: { notifications?: number; messages?: number }) => void;
  applyAuthResponse: (payload: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; email: string; unreadNotifications: number }>(
        "/auth/me",
      );
      setUserState(data.user);
      setEmail(data.email);
      setUnreadNotifications(data.unreadNotifications);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await tokens.clear();
      }
      setUserState(null);
      setEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await tokens.load();
      if (!stored.accessToken && !stored.refreshToken) {
        setLoading(false);
        return;
      }
      await refreshUser();
    })();
  }, [refreshUser]);

  const applyAuthResponse = useCallback(
    async (payload: { accessToken: string; refreshToken: string; user: User }) => {
      await tokens.set(payload.accessToken, payload.refreshToken);
      setUserState(payload.user);
      setLoading(false);
    },
    [],
  );

  const login = useCallback(
    async (emailInput: string, password: string) => {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { email: emailInput, password },
        { auth: false },
      );
      await applyAuthResponse(data);
      await refreshUser();
    },
    [applyAuthResponse, refreshUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // yerelde her hâlükârda çıkış yapılır
    }
    disconnectSocket();
    await tokens.clear();
    setUserState(null);
    setEmail(null);
    setUnreadNotifications(0);
    setUnreadMessages(0);
  }, []);

  const setCounts = useCallback((counts: { notifications?: number; messages?: number }) => {
    if (counts.notifications !== undefined) setUnreadNotifications(counts.notifications);
    if (counts.messages !== undefined) setUnreadMessages(counts.messages);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      email,
      loading,
      unreadNotifications,
      unreadMessages,
      login,
      logout,
      refreshUser,
      setUser: setUserState,
      setCounts,
      applyAuthResponse,
    }),
    [
      user, email, loading, unreadNotifications, unreadMessages,
      login, logout, refreshUser, setCounts, applyAuthResponse,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  return context;
}
