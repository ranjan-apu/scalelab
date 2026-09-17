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

/** Tab-local memory of "the server said 401": skip repeat doomed calls. */
const NO_SESSION_KEY = 'scalelab.no-session';

/**
 * The Worker's readable presence marker (see backend cookies.ts). True
 * means a session cookie was set here at some point; false means calling
 * /me could only 401. Unreadable environments (no DOM) answer true so the
 * check, not the guess, decides.
 */
function hasAuthMarker(): boolean {
  try {
    return document.cookie
      .split(';')
      .some((part) => part.trim().startsWith('scalelab-auth='));
  } catch {
    return true;
  }
}

/** Local dev never gets a marker (no shared parent domain), so it always
 *  checks — otherwise localhost would never log in. */
function isLocalHost(): boolean {
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!api.configured) {
      setLoading(false);
      return;
    }
    // No marker and no reason to expect a session: skip a round trip that
    // could only 401. The flag covers a stale marker (session died
    // server-side) within this tab.
    let skip = false;
    try {
      skip =
        !isLocalHost() &&
        (!hasAuthMarker() ||
          sessionStorage.getItem(NO_SESSION_KEY) !== null);
    } catch {
      skip = false;
    }
    if (skip) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.me();
      setUser(user);
      try {
        sessionStorage.removeItem(NO_SESSION_KEY);
      } catch {
        // Private mode: the next refresh simply checks again.
      }
    } catch {
      setUser(null);
      try {
        sessionStorage.setItem(NO_SESSION_KEY, '1');
      } catch {
        // Private mode: the next refresh simply checks again.
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    if (!api.configured) return;
    try {
      sessionStorage.removeItem(NO_SESSION_KEY);
    } catch {
      // Private mode: harmless, the callback's marker decides.
    }
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
      try {
        // The Worker clears the marker cookie too; remember locally so the
        // next refresh skips instead of re-proving the obvious.
        sessionStorage.setItem(NO_SESSION_KEY, '1');
      } catch {
        // Private mode: the next refresh simply checks again.
      }
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
