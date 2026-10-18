// Static-only deployment: deliberately has no database or commerce imports.
export default {
  fetch() {
    return Response.json(
      {
        error:
          'Online services are temporarily unavailable. Please contact Herb-All directly.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  },
};
