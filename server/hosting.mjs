import { timingSafeEqual, createHash } from 'node:crypto';
import { ipAddress, attachDatabasePool } from '@vercel/functions';
import { database } from './db.mjs';
const attached = new WeakSet();
export function hostingResponse(error, status, extra = {}) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy':
          "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
        ...extra,
      },
    },
  );
}
export function environmentGate() {
  // This release deliberately has no Preview/Development database access on Vercel.
  if (
    process.env.VERCEL_ENV &&
    process.env.VERCEL_ENV !== 'production' &&
    process.env.DATABASE_URL
  )
    return hostingResponse(
      'Commerce is not configured for this environment.',
      503,
    );
  if (process.env.VERCEL_ENV === 'production' && !process.env.PUBLIC_SITE_URL)
    return hostingResponse(
      'The production site origin is not configured.',
      503,
    );
}
export function preparePool() {
  if (!process.env.DATABASE_URL) return;
  const pool = database();
  if (!attached.has(pool)) {
    attachDatabasePool(pool);
    attached.add(pool);
  }
}
export function clientIp(request) {
  return ipAddress(request) || 'unknown';
}
export function cronAuthorized(request) {
  const key = process.env.CRON_SECRET;
  if (!key || key.length < 32) return false;
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(
    digest(request.headers.get('authorization') || ''),
    digest(`Bearer ${key}`),
  );
}
