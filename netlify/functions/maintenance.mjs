import { runMaintenance } from '../../server/maintenance.mjs';
// Legacy rollback adapter; Vercel never imports or invokes this file.
export default async () => {
  if (!process.env.DATABASE_URL) return new Response(null, { status: 204 });
  await runMaintenance();
  return new Response(null, { status: 204 });
};
export const config = { schedule: '*/15 * * * *' };
