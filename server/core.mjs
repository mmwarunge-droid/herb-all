import {
  randomUUID,
  randomBytes,
  createHash,
  createHmac,
  scrypt as rawScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(rawScrypt);
export const id = () => randomUUID();
export const token = () => randomBytes(32).toString('base64url');
export const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function text(v, label, max = 200, required = true) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    fail(`Check ${label}.`);
  return v.trim();
}
export function integer(v, label, min = 0, max = 10000) {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail(`Check ${label}.`);
  return v;
}
export function cents(v) {
  const s = String(v);
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s))
    fail('Enter a valid KES amount with at most two decimal places.');
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export const money = (n) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    currencyDisplay: 'code',
  }).format(n / 100);
export function phone(v) {
  const s = String(v || '')
    .replace(/[\s()-]/g, '')
    .replace(/^0/, '+254')
    .replace(/^254/, '+254');
  if (!/^\+254[17]\d{8}$/.test(s)) fail('Enter a valid Kenyan mobile number.');
  return s;
}
export function accessToken(key) {
  const secret = process.env.ORDER_TOKEN_SECRET;
  if (!secret || secret.length < 32)
    fail('Order security is not configured.', 503);
  return createHmac('sha256', secret).update(key).digest('base64url');
}
// Launch is an explicit operational decision; absence or malformed values fail closed.
export const checkoutEnabled = () =>
  process.env.COMMERCE_CHECKOUT_ENABLED === 'true' &&
  (process.env.ORDER_TOKEN_SECRET?.length ?? 0) >= 32;
export function finance(o) {
  const merchandise = Number(o.subtotal_cents) + Number(o.adjustment_cents);
  const transport =
    o.transport_cents === null ? null : Number(o.transport_cents);
  const deposit = Math.ceil(merchandise / 2);
  const paid = Number(o.verified_cents) - Number(o.refunded_cents);
  const total = merchandise + (transport ?? 0);
  const initial =
    deposit + (o.transport_policy === 'upfront' ? (transport ?? 0) : 0);
  const closed = [
    'cancelled',
    'expired',
    'refund_pending',
    'refunded',
  ].includes(o.status);
  const depositOutstanding = closed ? 0 : Math.max(0, initial - paid);
  const outstanding = closed ? 0 : Math.max(0, total - paid);
  const dispatchDue = closed
    ? 0
    : Math.max(
        0,
        (o.balance_policy === 'before_dispatch' ? merchandise : deposit) +
          (o.transport_policy === 'upfront' ? (transport ?? 0) : 0) -
          paid,
      );
  return {
    merchandise_cents: merchandise,
    deposit_cents: deposit,
    transport_cents: transport,
    total_cents: transport === null ? null : total,
    paid_cents: paid,
    deposit_outstanding_cents: depositOutstanding,
    outstanding_cents: outstanding,
    dispatch_due_cents: dispatchDue,
    current_due_cents:
      closed || !o.stock_confirmed || transport === null
        ? 0
        : depositOutstanding > 0
          ? depositOutstanding
          : o.status === 'dispatched'
            ? outstanding
            : dispatchDue,
    overpayment_cents: closed ? 0 : Math.max(0, paid - total),
    refund_due_cents: closed ? paid : Math.max(0, paid - total),
  };
}
export async function passwordHash(password) {
  text(password, 'password', 128);
  if (password.length < 12) fail('Use a password with at least 12 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function checkPassword(password, stored) {
  const [, salt, digest] = stored.split(':');
  const key = await scrypt(String(password), salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}
export const permissions = {
  super: ['inventory', 'orders', 'payments', 'settings', 'accounts'],
  inventory: ['inventory'],
  orders: ['orders'],
  payments: ['payments'],
};
export function permit(admin, permission) {
  if (!permissions[admin.role]?.includes(permission))
    fail('You do not have permission for this action.', 403);
}
export function uuid(value) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value || '',
    )
  )
    fail('Invalid identifier.');
  return value;
}
