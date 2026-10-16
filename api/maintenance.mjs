import { runMaintenance } from '../server/maintenance.mjs';
import {
  environmentGate,
  cronAuthorized,
  hostingResponse,
  preparePool,
} from '../server/hosting.mjs';
export default {
  async fetch(request) {
    if (request.method !== 'GET')
      return hostingResponse('Method not allowed.', 405, { Allow: 'GET' });
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
      return hostingResponse(
        'Maintenance is disabled for this environment.',
        503,
      );
    const gate = environmentGate();
    if (gate) return gate;
    if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)
      return hostingResponse('Maintenance is not configured.', 503);
    if (!cronAuthorized(request))
      return hostingResponse('Not authorized.', 401);
    if (!process.env.DATABASE_URL)
      return hostingResponse('Maintenance database is not configured.', 503);
    try {
      preparePool();
      await runMaintenance();
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          'Referrer-Policy': 'no-referrer',
        },
      });
    } catch {
      // Never emit provider errors, credentials or partial-success acknowledgement.
      return hostingResponse('Maintenance could not be completed.', 503);
    }
  },
};
