import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError, apiRequest, configureApiAuth } from "../api/client";
import { tokenStorage } from "./storage";

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface CurrentUser {
  username: string;
}

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  username: string | null;
  sessionMessage: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearSessionMessage: () => void;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? "checking" : "unauthenticated",
  );
  const [username, setUsername] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const expireSession = useCallback(() => {
    tokenStorage.clear();
    setUsername(null);
    setStatus("unauthenticated");
    setSessionMessage("Your session expired. Sign in again to continue.");
  }, []);

  useEffect(() => configureApiAuth({ getToken: () => tokenStorage.get(), onUnauthorized: expireSession }), [expireSession]);

  const validateSession = useCallback(async () => {
    if (!tokenStorage.get()) {
      setStatus("unauthenticated");
      return;
    }
    setStatus("checking");
    try {
      const user = await apiRequest<CurrentUser>("/auth/me");
      setUsername(user.username);
      setStatus("authenticated");
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return;
      }
      setUsername(null);
      setStatus("unavailable");
      setSessionMessage("Unable to verify your session. Check the backend connection and retry.");
    }
  }, [expireSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void validateSession(); }, 0);
    return () => window.clearTimeout(timer);
  }, [validateSession]);

  const retrySession = useCallback(() => {
    void validateSession();
  }, [validateSession]);

  const login = useCallback(async (loginUsername: string, password: string) => {
    setSessionMessage(null);
    const response = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { username: loginUsername, password },
    });
    tokenStorage.set(response.access_token);
    setUsername(loginUsername);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUsername(null);
    setStatus("unauthenticated");
    setSessionMessage(null);
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, username, sessionMessage, login, logout, clearSessionMessage, retrySession }),
    [status, username, sessionMessage, login, logout, clearSessionMessage, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
