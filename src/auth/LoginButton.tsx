import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import './LoginButton.css';

/**
 * Sign in with Google (via the Cloudflare Worker) + avatar menu.
 * Sits in the top bar next to Share. When VITE_API_URL is unset the
 * button renders disabled with a tooltip, so the app runs fully offline.
 */
export function LoginButton() {
  const { user, loading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  if (loading) {
    return (
      <button type="button" className="auth-btn is-loading" disabled aria-label="Checking login">
        <span className="auth-spinner" aria-hidden="true" />
      </button>
    );
  }

  if (!api.configured) {
    return (
      <button
        type="button"
        className="auth-btn"
        disabled
        title="Set VITE_API_URL to enable Google login (see backend/README.md)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.4 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z"
          />
          <path
            fill="#EA4335"
            d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z"
          />
        </svg>
        <span className="auth-label">Login</span>
      </button>
    );
  }

  if (!user) {
    return (
      <button type="button" className="auth-btn is-signin" onClick={login} title="Sign in with Google">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.4 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z"
          />
          <path
            fill="#EA4335"
            d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z"
          />
        </svg>
        <span className="auth-label">Sign in</span>
      </button>
    );
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="auth-wrap" ref={wrapRef}>
      <button
        type="button"
        className="auth-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.email}`}
        title={user.email}
        onClick={() => setOpen((o) => !o)}
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" width={24} height={24} referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>
      {open && (
        <div className="auth-menu" role="menu">
          <p className="auth-menu-name">{user.name || 'Signed in'}</p>
          <p className="auth-menu-email">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            className="auth-menu-item"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
