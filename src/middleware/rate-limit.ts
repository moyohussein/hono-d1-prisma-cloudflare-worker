import type { MiddlewareHandler } from "hono";

// Simple in-memory rate limiter (per instance) for development
// Not suitable for multi-instance/production without shared storage.

type Bucket = { tokens: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  windowMs: number; // e.g., 60_000
  max: number; // e.g., 10
  key?: (c: any) => string; // custom key builder
};

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max } = opts;
  const getKey = opts.key ?? ((c: any) => `${c.req.header("cf-connecting-ip") || "ip:unknown"}:${c.req.path}`);

  return async (c, next) => {
    const key = getKey(c);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { tokens: max - 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (bucket.tokens <= 0) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfterSec));
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));
      return c.json({ success: false, error: "Too many requests" }, 429);
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(bucket.tokens));
    c.header("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    await next();
  };
}
