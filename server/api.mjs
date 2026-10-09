import sharp from 'sharp';
import { transaction, row } from './db.mjs';
import {
  id,
  token,
  hash,
  text,
  integer,
  phone,
  fail,
  checkPassword,
  passwordHash,
  permit,
  uuid,
} from './core.mjs';
import {
  settings,
  audit,
  expire,
  products,
  saveProduct,
  adjustStock,
  cartQuote,
  placeOrder,
  customerOrder,
  detail,
  submitPayment,
  decidePayment,
  orderAction,
  refund,
} from './commerce.mjs';
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, ...extra },
  });
function cookie(req) {
  return (req.headers.get('cookie') || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('ha_session='))
    ?.slice(11);
}
function originCheck(req) {
  const origin = req.headers.get('origin');
  const expected = new URL(process.env.PUBLIC_SITE_URL || req.url).origin;
  if (origin !== expected) fail('Request origin is not allowed.', 403);
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json')
    fail('Send JSON data.', 415);
}
export async function limit(c, key, max = 60, minutes = 15) {
  const h = hash(key);
  const r = await row(
    c,
    `INSERT INTO rate_limits(key,hits,reset_at) VALUES($1,1,now()+($2*interval '1 minute')) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.hits+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+($2*interval '1 minute') ELSE rate_limits.reset_at END RETURNING hits`,
    [h, minutes],
  );
  if (r.hits > max) fail('Too many attempts. Please try again later.', 429);
}
async function administrator(c, req, mutation) {
  const session = await row(
    c,
    'SELECT a.*,s.csrf FROM sessions s JOIN administrators a ON a.id=s.administrator_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active',
    [hash(cookie(req) || '')],
  );
  if (!session) fail('Please log in.', 401);
  if (mutation && req.headers.get('x-csrf-token') !== session.csrf)
    fail('Refresh your session before submitting.', 403);
  return session;
}
const publicAdmin = (a) => ({
  id: a.id,
  email: a.email,
  role: a.role,
  csrf: a.csrf,
});
async function image(c, b, options) {
  if (typeof b.data !== 'string' || b.data.length > 2800000)
    fail('Choose an image smaller than 2 MB.');
  const bytes = Buffer.from(b.data, 'base64');
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 20)
    fail('Choose an image smaller than 2 MB.');
  const magic = bytes.subarray(0, 12);
  if (
    !(magic[0] === 255 && magic[1] === 216) &&
    magic.toString('hex', 0, 8) !== '89504e470d0a1a0a' &&
    !(
      magic.toString('ascii', 0, 4) === 'RIFF' &&
      magic.toString('ascii', 8, 12) === 'WEBP'
    )
  )
    fail('Only JPEG, PNG and WebP images are accepted.');
  let output;
  try {
    const processor = sharp(bytes, {
      limitInputPixels: 20000000,
      animated: false,
    });
    const meta = await processor.metadata();
    if (meta.pages > 1) fail('Animated images are not supported.');
    output = await processor
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    fail('This image could not be safely processed.');
  }
  const mediaId = id();
  await c.query(
    'INSERT INTO media(id,bytes,content_type,alt,product_id,private) VALUES($1,$2,$3,$4,$5,$6)',
    [
      mediaId,
      output,
      'image/webp',
      text(b.alt || 'Payment receipt', 'image description', 250),
      options.product_id || null,
      !!options.private,
    ],
  );
  return mediaId;
}
export async function estimateDistance(order) {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  const lat = Number(process.env.FARM_LATITUDE),
    lng = Number(process.env.FARM_LONGITUDE);
  if (
    !key ||
    !process.env.FARM_LATITUDE ||
    !process.env.FARM_LONGITUDE ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return { status: 'manual', distance_meters: null };
  try {
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        signal: AbortSignal.timeout(6000),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: lat, longitude: lng } } },
          destination: {
            address: [
              order.destination.address,
              order.destination.estate,
              order.destination.town,
              order.destination.county,
              'Kenya',
            ]
              .filter(Boolean)
              .join(', '),
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      },
    );
    const data = await response.json();
    const d = data.routes?.[0]?.distanceMeters;
    if (!response.ok || !Number.isInteger(d) || d < 0)
      return { status: 'unavailable', distance_meters: null };
    return { status: 'estimated_road', distance_meters: d };
  } catch {
    return { status: 'unavailable', distance_meters: null };
  }
}
async function idempotent(c, a, req, path, b, fn) {
  if (req.method === 'GET') return fn();
  // Re-check current permissions before returning a cached mutation response.
  const permission = path.startsWith('admin/accounts')
    ? 'accounts'
    : path === 'admin/settings'
      ? 'settings'
      : ['admin/products', 'admin/stock', 'admin/image'].includes(path)
        ? 'inventory'
        : ['admin/payments/decision', 'admin/refund'].includes(path)
          ? 'payments'
          : ['admin/order', 'admin/distance'].includes(path)
            ? 'orders'
            : null;
  if (permission) permit(a, permission);
  const key = text(req.headers.get('idempotency-key'), 'submission key', 100);
  if (!/^[a-zA-Z0-9_-]{24,100}$/.test(key)) fail('Invalid submission key.');
  const keyHash = hash(a.id + ':' + path + ':' + key),
    requestHash = hash(JSON.stringify(b));
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    keyHash,
  ]);
  const prior = await row(
    c,
    'SELECT * FROM operation_receipts WHERE key_hash=$1',
    [keyHash],
  );
  if (prior) {
    if (prior.request_hash !== requestHash)
      fail('This submission key was already used for a different action.', 409);
    return prior.response;
  }
  const result = await fn();
  await c.query(
    'INSERT INTO operation_receipts(key_hash,administrator_id,request_hash,response) VALUES($1,$2,$3,$4)',
    [keyHash, a.id, requestHash, JSON.stringify(result)],
  );
  return result;
}
export async function handler(req, context = {}) {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const method = req.method;
    const mutation = method !== 'GET';
    if (!['GET', 'POST', 'DELETE'].includes(method))
      fail('Method not allowed.', 405);
    let b = {};
    if (mutation) {
      originCheck(req);
      if (Number(req.headers.get('content-length')) > 6000000)
        fail('Request too large.', 413);
      const raw = await req.text();
      if (Buffer.byteLength(raw) > 6000000) fail('Request too large.', 413);
      try {
        b = JSON.parse(raw);
      } catch {
        fail('Invalid JSON.');
      }
      if (!b || typeof b !== 'object' || Array.isArray(b))
        fail('Invalid request.');
    }
    const ip = context.ip || 'unknown';
    // Rate-limit writes in a separate transaction: rejected operations must not erase their attempt counter.
    if (mutation)
      await transaction((c) =>
        limit(
          c,
          path === 'auth/login' || path === 'auth/reset'
            ? `auth:${ip}`
            : `write:${ip}`,
          path.startsWith('auth/') ? 12 : 100,
        ),
      );
    if (path === 'auth/login' && method === 'POST') {
      const email = text(b.email, 'email', 254).toLowerCase();
      text(b.password, 'password', 128);
      await transaction((c) => limit(c, 'login-email:' + email, 12));
      const result = await transaction(async (c) => {
        const a = await row(
          c,
          'SELECT * FROM administrators WHERE email=$1 AND active',
          [email],
        );
        const dummy =
          'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
        if (!(await checkPassword(b.password, a?.password_hash || dummy)) || !a)
          fail('Email or password is incorrect.', 401);
        const session = token(),
          csrf = token();
        await c.query(
          "INSERT INTO sessions(token_hash,administrator_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
          [hash(session), a.id, csrf],
        );
        await audit(c, a, 'login', a.id);
        return { session, user: { ...publicAdmin(a), csrf } };
      });
      return json(result.user, 200, {
        'Set-Cookie': `ha_session=${result.session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.APP_ENV === 'development' ? '' : '; Secure'}`,
      });
    }
    if (path === 'auth/reset' && method === 'POST')
      return json(
        await transaction(async (c) => {
          const reset = await row(
            c,
            'SELECT * FROM password_resets WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE',
            [hash(text(b.token, 'recovery token', 200))],
          );
          if (!reset) fail('Recovery token is invalid or expired.');
          await c.query(
            'UPDATE administrators SET password_hash=$2 WHERE id=$1',
            [reset.administrator_id, await passwordHash(b.password)],
          );
          await c.query(
            'UPDATE password_resets SET used_at=now() WHERE token_hash=$1',
            [hash(b.token)],
          );
          await c.query('DELETE FROM sessions WHERE administrator_id=$1', [
            reset.administrator_id,
          ]);
          await audit(
            c,
            { id: reset.administrator_id },
            'password recovered',
            reset.administrator_id,
          );
          return {
            message: 'Password updated. Log in with your new password.',
          };
        }),
      );
    if (path === 'public/settings' && method === 'GET')
      return json(
        await transaction(async (c) => {
          const s = await settings(c);
          return {
            collection_enabled: s.collection_enabled,
            reservation_hours: s.reservation_hours,
            transport_policy: s.transport_policy,
            balance_policy: s.balance_policy,
          };
        }),
      );
    if (path === 'products' && method === 'GET')
      return json(
        await transaction((c) =>
          products(c, Object.fromEntries(url.searchParams)),
        ),
      );
    if (path === 'categories' && method === 'GET')
      return json(
        await transaction(
          async (c) =>
            (await c.query('SELECT name FROM categories ORDER BY name')).rows,
        ),
      );
    if (path === 'quote' && method === 'POST')
      return json(
        await transaction(async (c) => {
          await expire(c);
          return cartQuote(c, b.items);
        }),
      );
    if (path === 'orders' && method === 'POST')
      return json(
        await transaction((c) =>
          placeOrder(c, b, req.headers.get('idempotency-key')),
        ),
        201,
      );
    if (path === 'track' && method === 'POST')
      return json(
        await transaction(async (c) => {
          await expire(c);
          return detail(
            c,
            await customerOrder(c, b.reference, b.tracking_token),
          );
        }),
      );
    if (path === 'payment' && method === 'POST')
      return json(
        await transaction(async (c) => {
          await expire(c);
          return submitPayment(
            c,
            await customerOrder(c, b.order_reference, b.tracking_token),
            b,
          );
        }),
      );
    if (path === 'payment/attachment' && method === 'POST')
      return json(
        await transaction(async (c) => {
          const o = await customerOrder(c, b.order_reference, b.tracking_token);
          const payment = await row(
            c,
            "SELECT * FROM payments WHERE id=$1 AND order_id=$2 AND state='pending' FOR UPDATE",
            [uuid(b.payment_id), o.id],
          );
          if (!payment) fail('Pending submission not found.', 404);
          if (payment.attachment_id)
            fail('An attachment has already been submitted.', 409);
          const mediaId = await image(c, b, { private: true });
          await c.query('UPDATE payments SET attachment_id=$2 WHERE id=$1', [
            payment.id,
            mediaId,
          ]);
          return { message: 'Receipt attached privately.' };
        }),
      );
    if (path.startsWith('media/') && method === 'GET')
      return await transaction(async (c) => {
        const m = await row(c, 'SELECT * FROM media WHERE id=$1', [
          uuid(path.split('/')[1]),
        ]);
        if (!m) fail('Image not found.', 404);
        if (m.private) {
          const a = await administrator(c, req, false);
          permit(a, 'payments');
        }
        return new Response(m.bytes, {
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': m.private ? 'no-store' : 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      });
    if (
      path.startsWith('admin/') ||
      path === 'auth/me' ||
      path === 'auth/logout'
    )
      return json(
        await transaction(async (c) => {
          const a = await administrator(c, req, mutation);
          if (path === 'auth/me' && method === 'GET') return publicAdmin(a);
          if (path === 'auth/logout' && method === 'POST') {
            await c.query('DELETE FROM sessions WHERE token_hash=$1', [
              hash(cookie(req)),
            ]);
            return { message: 'Logged out.' };
          }
          return idempotent(c, a, req, path, b, async () => {
            if (path === 'admin/settings') {
              permit(a, 'settings');
              if (method === 'GET') return settings(c);
              if (method !== 'POST') fail('Method not allowed.', 405);
              const old = await settings(c);
              const data = {
                ...old,
                collection_enabled: b.collection_enabled === true,
                reservation_hours: integer(
                  b.reservation_hours,
                  'reservation hours',
                  1,
                  168,
                ),
                transport_policy: b.transport_policy,
                balance_policy: b.balance_policy,
                payment_enabled: b.payment_enabled === true,
                payee: text(b.payee ?? '', 'payee', 150, false),
                pochi_phone: b.pochi_phone ? phone(b.pochi_phone) : '',
                payment_instructions: text(
                  b.payment_instructions ?? '',
                  'payment instructions',
                  2000,
                  false,
                ),
              };
              if (
                !['upfront', 'delivery'].includes(data.transport_policy) ||
                !['before_dispatch', 'delivery'].includes(data.balance_policy)
              )
                fail('Choose payment policies.');
              if (
                data.payment_enabled &&
                (!data.payee ||
                  !data.pochi_phone ||
                  !data.payment_instructions ||
                  !b.confirmed)
              )
                fail(
                  'Verify the Pochi account and instructions before enabling payments.',
                );
              await c.query(
                'UPDATE settings SET data=$1,updated_at=now() WHERE id=1',
                [data],
              );
              await audit(c, a, 'settings updated', null, {
                payment_enabled: data.payment_enabled,
                collection_enabled: data.collection_enabled,
              });
              return data;
            }
            if (path === 'admin/accounts') {
              permit(a, 'accounts');
              if (method === 'GET')
                return (
                  await c.query(
                    'SELECT id,email,role,active FROM administrators ORDER BY email',
                  )
                ).rows;
              if (method !== 'POST') fail('Method not allowed.', 405);
              const email = text(b.email, 'email', 254).toLowerCase();
              if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                !['super', 'inventory', 'orders', 'payments'].includes(b.role)
              )
                fail('Check email and role.');
              const user = await row(
                c,
                'INSERT INTO administrators(id,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,email,role',
                [id(), email, await passwordHash(b.password), b.role],
              );
              await audit(c, a, 'administrator created', user.id, {
                email,
                role: b.role,
              });
              return user;
            }
            if (path === 'admin/accounts/role' && method === 'POST') {
              permit(a, 'accounts');
              const targetId = uuid(b.id);
              if (targetId === a.id)
                fail('Ask another super administrator to change your role.');
              if (
                !['super', 'inventory', 'orders', 'payments'].includes(b.role)
              )
                fail('Choose a supported role.');
              await c.query('SELECT pg_advisory_xact_lock(81324002)');
              const target = await row(
                c,
                'SELECT * FROM administrators WHERE id=$1 FOR UPDATE',
                [targetId],
              );
              if (!target) fail('Administrator not found.', 404);
              if (
                target.active &&
                target.role === 'super' &&
                b.role !== 'super' &&
                Number(
                  (
                    await row(
                      c,
                      "SELECT count(*) n FROM administrators WHERE active AND role='super'",
                    )
                  ).n,
                ) <= 1
              )
                fail('Keep at least one active super administrator.', 409);
              await c.query('UPDATE administrators SET role=$2 WHERE id=$1', [
                targetId,
                b.role,
              ]);
              await c.query('DELETE FROM sessions WHERE administrator_id=$1', [
                targetId,
              ]);
              await audit(c, a, 'administrator role changed', targetId, {
                previous_role: target.role,
                role: b.role,
              });
              return { message: 'Role updated and sessions revoked.' };
            }
            if (path === 'admin/accounts/disable' && method === 'POST') {
              permit(a, 'accounts');
              if (b.id === a.id) fail('You cannot disable your own session.');
              await c.query('SELECT pg_advisory_xact_lock(81324002)');
              const target = await row(
                c,
                'SELECT * FROM administrators WHERE id=$1 FOR UPDATE',
                [uuid(b.id)],
              );
              if (!target) fail('Administrator not found.', 404);
              if (
                target.active &&
                target.role === 'super' &&
                Number(
                  (
                    await row(
                      c,
                      "SELECT count(*) n FROM administrators WHERE active AND role='super'",
                    )
                  ).n,
                ) <= 1
              )
                fail('Keep at least one active super administrator.', 409);
              await c.query(
                'UPDATE administrators SET active=false WHERE id=$1',
                [uuid(b.id)],
              );
              await c.query('DELETE FROM sessions WHERE administrator_id=$1', [
                b.id,
              ]);
              await audit(c, a, 'administrator disabled', b.id);
              return { message: 'Administrator disabled.' };
            }
            if (path === 'admin/products') {
              permit(a, 'inventory');
              if (method === 'GET')
                return products(c, Object.fromEntries(url.searchParams), true);
              if (method !== 'POST') fail('Method not allowed.', 405);
              return saveProduct(c, b, a);
            }
            if (path === 'admin/stock' && method === 'POST') {
              permit(a, 'inventory');
              return adjustStock(c, b, a);
            }
            if (path === 'admin/inventory' && method === 'GET') {
              permit(a, 'inventory');
              return (
                await c.query(
                  'SELECT m.*,p.name FROM inventory_movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 100',
                )
              ).rows;
            }
            if (path === 'admin/image' && method === 'POST') {
              permit(a, 'inventory');
              const p = await row(c, 'SELECT id FROM products WHERE id=$1', [
                uuid(b.product_id),
              ]);
              if (!p) fail('Product not found.', 404);
              if (
                Number(
                  (
                    await row(
                      c,
                      'SELECT count(*) n FROM media WHERE product_id=$1',
                      [p.id],
                    )
                  ).n,
                ) >= 8
              )
                fail('Use at most eight gallery images.');
              const mediaId = await image(c, b, { product_id: p.id });
              await audit(c, a, 'product image uploaded', p.id);
              return { id: mediaId };
            }
            if (path === 'admin/image' && method === 'DELETE') {
              permit(a, 'inventory');
              const m = await row(
                c,
                'DELETE FROM media WHERE id=$1 AND NOT private RETURNING id',
                [uuid(b.id)],
              );
              if (!m) fail('Image not found.', 404);
              await audit(c, a, 'product image removed', m.id);
              return { message: 'Image removed.' };
            }
            if (path === 'admin/orders' && method === 'GET') {
              if (!['super', 'orders', 'payments'].includes(a.role))
                fail('Permission denied.', 403);
              await expire(c);
              const query = String(url.searchParams.get('q') || '').slice(
                  0,
                  100,
                ),
                state = String(url.searchParams.get('status') || '');
              const page = Math.max(
                1,
                Number(url.searchParams.get('page')) || 1,
              );
              return (
                await c.query(
                  "SELECT id,reference,status,customer,subtotal_cents,verified_cents,transport_cents,created_at,count(*) OVER() total_count FROM orders WHERE (reference ILIKE $1 OR customer->>'name' ILIKE $1 OR customer->>'phone' ILIKE $1) AND ($2='' OR status=$2) AND ($3='' OR created_at::date >= NULLIF($3,'')::date) AND ($4='' OR created_at::date <= NULLIF($4,'')::date) ORDER BY created_at DESC LIMIT 50 OFFSET $5",
                  [
                    '%' + query + '%',
                    state,
                    url.searchParams.get('from') || '',
                    url.searchParams.get('to') || '',
                    (page - 1) * 50,
                  ],
                )
              ).rows;
            }
            if (path === 'admin/payments' && method === 'GET') {
              permit(a, 'payments');
              return (
                await c.query(
                  "SELECT p.*,o.reference order_reference FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.state IN ('pending','clarification') ORDER BY p.created_at LIMIT 100",
                )
              ).rows.map((p) => ({
                ...p,
                reported_cents: Number(p.reported_cents),
              }));
            }
            if (path === 'admin/payments/decision' && method === 'POST') {
              permit(a, 'payments');
              return decidePayment(c, b, a);
            }
            if (path === 'admin/order') {
              if (!['super', 'orders', 'payments'].includes(a.role))
                fail('Permission denied.', 403);
              const o = await row(
                c,
                'SELECT * FROM orders WHERE reference=$1 FOR UPDATE',
                [
                  text(
                    method === 'GET'
                      ? url.searchParams.get('reference')
                      : b.reference,
                    'order reference',
                    40,
                  ),
                ],
              );
              if (!o) fail('Order not found.', 404);
              if (method === 'GET') return detail(c, o, true);
              permit(a, 'orders');
              return orderAction(c, o, b, a);
            }
            if (path === 'admin/refund' && method === 'POST') {
              permit(a, 'payments');
              const o = await row(
                c,
                'SELECT * FROM orders WHERE reference=$1 FOR UPDATE',
                [text(b.reference, 'order reference', 40)],
              );
              if (!o) fail('Order not found.', 404);
              return refund(c, o, b, a);
            }
            if (path === 'admin/distance' && method === 'POST') {
              permit(a, 'orders');
              const o = await row(
                c,
                'SELECT * FROM orders WHERE reference=$1 FOR UPDATE',
                [text(b.reference, 'order reference', 40)],
              );
              if (!o || o.delivery_method !== 'delivery')
                fail('Delivery order not found.', 404);
              const result = await estimateDistance(o);
              await c.query(
                'UPDATE orders SET distance_meters=$2,distance_status=$3 WHERE id=$1',
                [o.id, result.distance_meters, result.status],
              );
              await audit(c, a, 'distance estimated', o.id, result);
              return result;
            }
            if (path === 'admin/dashboard' && method === 'GET') {
              await expire(c);
              const summary = {};
              if (['super', 'inventory'].includes(a.role))
                summary.inventory = await row(
                  c,
                  'SELECT count(*) FILTER(WHERE published AND NOT archived) active,count(*) FILTER(WHERE stock-reserved=0 AND NOT archived) out_of_stock,count(*) FILTER(WHERE stock-reserved>0 AND stock-reserved<=low_stock AND NOT archived) low_stock FROM products',
                );
              if (['super', 'orders', 'payments'].includes(a.role)) {
                summary.orders = (
                  await c.query(
                    'SELECT status,count(*) count FROM orders GROUP BY status',
                  )
                ).rows;
                if (['super', 'payments'].includes(a.role))
                  summary.pending_payments = Number(
                    (
                      await row(
                        c,
                        "SELECT count(*) n FROM payments WHERE state IN ('pending','clarification')",
                      )
                    ).n,
                  );
              }
              summary.activity = (
                await c.query(
                  "SELECT action,created_at FROM audit_events WHERE administrator_id=$1 OR $2='super' ORDER BY created_at DESC LIMIT 20",
                  [a.id, a.role],
                )
              ).rows;
              return summary;
            }
            fail('Endpoint not found.', 404);
          });
        }),
      );
    fail('Endpoint not found.', 404);
  } catch (e) {
    if (!e.status)
      console.error('Commerce request failed', { code: e.code || 'internal' });
    return json(
      {
        error: e.status
          ? e.message
          : e.code === '23505'
            ? 'A duplicate reference or SKU was submitted.'
            : e.code === '23514'
              ? 'The change would violate stock or financial limits.'
              : 'The request could not be completed. Please retry or contact Herb-All.',
      },
      e.status || (['23505', '23514'].includes(e.code) ? 409 : 500),
    );
  }
}
