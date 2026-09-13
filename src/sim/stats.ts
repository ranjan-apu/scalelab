/** Trailing-window statistics shared by the simulation engine.
 *
 * Extracted verbatim from engine.ts: bucketed rate counters and the
 * timestamped latency ring behind every p50/p95/p99 readout. Pure
 * data structures with no engine dependency, so they live here and the
 * engine imports them back.
 */

/** Trailing window for latency percentiles. */
export const LATENCY_WINDOW_MS = 5000;
/** Capacity of each latency ring buffer. */
export const LATENCY_RING = 4096;
/** Max samples sorted per percentile computation; beyond this the window is strided. */
export const PERCENTILE_SAMPLE_CAP = 512;
/** Trailing window for rate (per-second) measurements. */
export const RATE_WINDOW_MS = 1000;
/** Number of buckets the rate window is split into. */
export const RATE_BUCKETS = 10;

/* ------------------------------------------------------------------ *
 * Rate counter: bucketed trailing window
 * ------------------------------------------------------------------ */

export class RateCounter {
  private buckets = new Float64Array(RATE_BUCKETS);
  private stamps = new Float64Array(RATE_BUCKETS).fill(-1);
  private bucketMs = RATE_WINDOW_MS / RATE_BUCKETS;

  add(now: number, n: number): void {
    const stamp = Math.floor(now / this.bucketMs);
    const idx = ((stamp % RATE_BUCKETS) + RATE_BUCKETS) % RATE_BUCKETS;
    if (this.stamps[idx] !== stamp) {
      this.stamps[idx] = stamp;
      this.buckets[idx] = 0;
    }
    this.buckets[idx] += n;
  }

  /**
   * Events per second over the trailing window.
   *
   * Every counter divides by the SAME fixed span, so rates from different
   * counters stay comparable and their ratios mean something -- goodput can
   * never exceed offered just because one of them happened to be idle for
   * part of the window. The in-progress bucket is excluded rather than
   * scaled: a partially elapsed bucket read as if it were whole is what
   * makes a live rate flicker.
   */
  rate(now: number): number {
    const current = Math.floor(now / this.bucketMs);
    let total = 0;
    for (let i = 0; i < RATE_BUCKETS; i++) {
      const age = current - this.stamps[i];
      // Sum only the fully elapsed buckets. age === 0 is the bucket still
      // filling: reading a partially elapsed bucket as if it were whole is
      // what makes a live rate flicker at the sampling boundary.
      if (age > 0 && age < RATE_BUCKETS) {
        total += this.buckets[i];
      }
    }
    if (total === 0) return 0;
    // Divide by exactly the span the numerator covers. Two things this must
    // not do: divide by how many buckets happened to receive events (a quiet
    // bucket is a real zero and has to pull the average down, or bursty
    // traffic reads several times high), or include the in-progress bucket
    // the events could not have landed in (which under-reports every rate by
    // one bucket's worth). Every counter uses this same span, so goodput can
    // never exceed offered merely because one of them was briefly idle.
    const elapsedBuckets = Math.max(1, Math.min(RATE_BUCKETS - 1, current));
    return (total * 1000) / (elapsedBuckets * this.bucketMs);
  }

  reset(): void {
    this.buckets.fill(0);
    this.stamps.fill(-1);
  }
}

/* ------------------------------------------------------------------ *
 * Latency reservoir: ring buffer with timestamps, exact percentiles
 * ------------------------------------------------------------------ */

export class LatencyRing {
  private vals = new Float64Array(LATENCY_RING);
  private times = new Float64Array(LATENCY_RING);
  private head = 0;
  private count = 0;
  private scratch = new Float64Array(LATENCY_RING);
  /** Monotonic count of samples ever added; part of the memo key. */
  private added = 0;
  private cacheTime = -1;
  private cacheAdded = -1;
  private cache0 = 0;
  private cache1 = 0;
  private cache2 = 0;

  add(now: number, v: number): void {
    this.vals[this.head] = v;
    this.times[this.head] = now;
    this.head = (this.head + 1) % LATENCY_RING;
    if (this.count < LATENCY_RING) this.count++;
    this.added++;
  }

  /**
   * Fills out[0..2] with p50/p95/p99 over the trailing window.
   *
   * Results are memoized per (time, sample count): snapshot() is polled at
   * 10Hz and asks every node for percentiles, but the underlying samples only
   * change when a request completes. Re-sorting an unchanged window would
   * dominate the frame budget.
   */
  percentiles(now: number, out: Float64Array): void {
    if (now === this.cacheTime && this.added === this.cacheAdded) {
      out[0] = this.cache0;
      out[1] = this.cache1;
      out[2] = this.cache2;
      return;
    }

    const cutoff = now - LATENCY_WINDOW_MS;
    const s = this.scratch;
    let n = 0;
    // Walk newest-first and stop at the window edge. Sampling is capped: a
    // few hundred points give the same percentiles as several thousand, and
    // this keeps snapshot() cheap at 10Hz under heavy traffic.
    const limit =
      this.count < PERCENTILE_SAMPLE_CAP ? this.count : PERCENTILE_SAMPLE_CAP;
    const stride =
      this.count > PERCENTILE_SAMPLE_CAP
        ? Math.floor(this.count / PERCENTILE_SAMPLE_CAP)
        : 1;
    for (let i = 0, taken = 0; taken < limit && i < this.count; i += stride) {
      const idx = (this.head - 1 - i + LATENCY_RING * 2) % LATENCY_RING;
      if (this.times[idx] < cutoff) break;
      s[n++] = this.vals[idx];
      taken++;
    }
    if (n === 0) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    } else {
      // sort() on a subarray sorts in place over the shared buffer without
      // allocating a copy.
      const view = s.subarray(0, n);
      view.sort();
      out[0] = quantile(view, n, 0.5);
      out[1] = quantile(view, n, 0.95);
      out[2] = quantile(view, n, 0.99);
    }

    this.cacheTime = now;
    this.cacheAdded = this.added;
    this.cache0 = out[0];
    this.cache1 = out[1];
    this.cache2 = out[2];
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.added = 0;
    this.cacheTime = -1;
    this.cacheAdded = -1;
  }
}

export function quantile(sorted: Float64Array, n: number, q: number): number {
  if (n === 1) return sorted[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
