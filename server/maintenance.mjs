import { transaction } from './db.mjs';
import { expire } from './commerce.mjs';
import { deliverNotifications } from './notifications.mjs';
export async function runMaintenance() {
  await transaction(async (c) => {
    await expire(c, 10);
    await c.query(
      "DELETE FROM rate_limits WHERE reset_at<now()-interval '1 day'",
    );
    await c.query('DELETE FROM sessions WHERE expires_at<now()');
    await c.query('DELETE FROM password_resets WHERE expires_at<now()');
  });
  await deliverNotifications();
}
