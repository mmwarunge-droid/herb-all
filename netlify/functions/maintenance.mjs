import { transaction } from '../../server/db.mjs';
import { expire } from '../../server/commerce.mjs';
import { deliverNotifications } from '../../server/notifications.mjs';
export default async () => {
  // An intentionally unconfigured static deployment has no commerce data to maintain.
  if (!process.env.DATABASE_URL) return new Response(null, { status: 204 });
  await transaction(async (c) => {
    await expire(c, 10);
    await c.query(
      "DELETE FROM rate_limits WHERE reset_at<now()-interval '1 day'",
    );
    await c.query('DELETE FROM sessions WHERE expires_at<now()');
    await c.query('DELETE FROM password_resets WHERE expires_at<now()');
  });
  await deliverNotifications();
  return new Response(null, { status: 204 });
};
export const config = { schedule: '*/15 * * * *' };
