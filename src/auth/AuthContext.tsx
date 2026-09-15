import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { ApiUser } from '../api/client';

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  /** Redirects to Google via the Worker. No-op when API is unconfigured. */
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!api.configured) {
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    if (!api.configured) return;
    window.location.href = api.loginUrl();
  }, []);

  const logout = useCallback(async () => {
    if (!api.configured) {
      setUser(null);
      return;
    }
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
