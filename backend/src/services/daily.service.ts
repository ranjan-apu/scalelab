/* Daily service: server-authoritative streaks (replaces localStorage daily.ts). */

import type { Bindings } from '../env';
import { nowSec, todayKeyUTC } from '../utils/time';

export async function recordDailyPlay(
  env: Bindings,
  userId: string,
): Promise<{ day: string; streak: number }> {
  const today = todayKeyUTC();
  const prev = await env.DB.prepare(
    `SELECT last_played, streak FROM daily_plays WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ last_played: string; streak: number }>();

  let streak = 1;
  if (prev) {
    if (prev.last_played === today) {
      streak = prev.streak;
    } else {
      const diff =
        Math.floor(Date.parse(today) / 86_400_000) -
        Math.floor(Date.parse(prev.last_played) / 86_400_000);
      streak = diff === 1 ? prev.streak + 1 : 1;
    }
  }

  await env.DB.prepare(
    `INSERT INTO daily_plays (user_id, last_played, streak, updated_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
     last_played=excluded.last_played, streak=excluded.streak, updated_at=excluded.updated_at`,
  )
    .bind(userId, today, streak, nowSec())
    .run();
  return { day: today, streak };
}
