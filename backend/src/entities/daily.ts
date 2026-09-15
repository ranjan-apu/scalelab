/* Daily-streak entities (mirror D1 `daily_plays` table). */

export interface DailyPlayRow {
  user_id: string;
  last_played: string; // YYYY-MM-DD (UTC)
  streak: number;
  updated_at: number;
}
