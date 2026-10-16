import { handler } from '../server/api.mjs';
import {
  environmentGate,
  preparePool,
  clientIp,
  hostingResponse,
} from '../server/hosting.mjs';
export default {
  async fetch(request) {
    const gate = environmentGate();
    if (gate) return gate;
    try {
      preparePool();
      return await handler(request, { ip: clientIp(request) });
    } catch {
      return hostingResponse(
        'The request could not be completed. Please retry or contact Herb-All.',
        503,
      );
    }
  },
};
