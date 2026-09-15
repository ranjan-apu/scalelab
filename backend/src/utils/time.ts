export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** YYYY-MM-DD in UTC. Used as the daily-streak day key. */
export function todayKeyUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
