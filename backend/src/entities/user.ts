/* User + session entities (mirror D1 `users` / `sessions` tables). */

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar: string;
  created_at: number;
  last_login_at: number;
}

/** What the API exposes as "current user" (no timestamps). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface SessionWithUserRow {
  id: string;
  email: string;
  name: string;
  avatar: string;
  expires_at: number;
}
