import { transaction, row } from './db.mjs';
// Supported Resend API, optional. Persisted events never block order commits.
export async function deliverNotifications() {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.NOTIFICATION_FROM ||
    !process.env.ADMIN_NOTIFICATION_EMAIL
  )
    return { configured: false };
  return transaction(async (c) => {
    const events = (
      await c.query(
        "SELECT * FROM notification_outbox WHERE sent_at IS NULL AND next_attempt_at<=now() AND (attempts=0 OR (attempts<3 AND created_at>now()-interval '23 hours')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 2",
      )
    ).rows;
    for (const event of events) {
      const o = await row(
        c,
        'SELECT reference,customer FROM orders WHERE id=$1',
        [event.order_id],
      );
      const recipients = [
        process.env.ADMIN_NOTIFICATION_EMAIL,
        ...(o.customer.email ? [o.customer.email] : []),
      ];
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: {
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'herb-all-' + event.id,
          },
          body: JSON.stringify({
            from: process.env.NOTIFICATION_FROM,
            to: recipients,
            subject: `Herb-All ${o.reference}: ${event.event}`,
            text: `Order ${o.reference}: ${event.event}. Check the Herb-All order page using your private tracking key for details. If you need assistance, contact the business directly.`,
          }),
        });
        if (!response.ok) throw new Error('Provider rejected');
        await c.query(
          'UPDATE notification_outbox SET sent_at=now(),attempts=attempts+1 WHERE id=$1',
          [event.id],
        );
      } catch {
        await c.query(
          "UPDATE notification_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '30 minutes' WHERE id=$1",
          [event.id],
        );
      }
    }
    return { configured: true, reviewed: events.length };
  });
}
