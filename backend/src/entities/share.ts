/* Share entities (mirror D1 `shares` table). */

export interface ShareRow {
  id: string;
  owner_user_id: string | null;
  payload: string;
  views: number;
  created_at: number;
}
