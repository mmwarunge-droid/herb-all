import { row } from './db.mjs';
import {
  id,
  hash,
  accessToken,
  checkoutEnabled,
  fail,
  text,
  integer,
  cents,
  phone,
  finance,
  uuid,
} from './core.mjs';
export async function settings(c) {
  const s = (await row(c, 'SELECT data FROM settings WHERE id=1')).data;
  return {
    collection_enabled: false,
    reservation_hours: 48,
    transport_policy: 'upfront',
    balance_policy: 'before_dispatch',
    payment_enabled: false,
    ...s,
  };
}
export async function audit(c, admin, action, entity, data = {}) {
  await c.query(
    'INSERT INTO audit_events(id,administrator_id,action,entity_id,data) VALUES($1,$2,$3,$4,$5)',
    [id(), admin?.id ?? null, action, entity ?? null, JSON.stringify(data)],
  );
}
export async function history(c, order, event, admin = null, data = {}) {
  await c.query(
    'INSERT INTO order_history(id,order_id,administrator_id,event,data) VALUES($1,$2,$3,$4,$5)',
    [id(), order.id, admin?.id ?? null, event, JSON.stringify(data)],
  );
  await c.query('UPDATE orders SET updated_at=now() WHERE id=$1', [order.id]);
  if (!event.startsWith('Internal'))
    await c.query(
      'INSERT INTO notification_outbox(id,order_id,event) VALUES($1,$2,$3)',
      [id(), order.id, event],
    );
}
export async function movement(c, p, order, admin, sd, rd, reason) {
  await c.query(
    'UPDATE products SET stock=stock+$2,reserved=reserved+$3,updated_at=now() WHERE id=$1',
    [p, sd, rd],
  );
  await c.query(
    'INSERT INTO inventory_movements(id,product_id,order_id,administrator_id,stock_delta,reserved_delta,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id(), p, order?.id ?? null, admin?.id ?? null, sd, rd, reason],
  );
}
async function inventory(c, o, action, admin) {
  if (o.inventory_state !== 'reserved') return;
  const items = (
    await c.query(
      'SELECT * FROM order_items WHERE order_id=$1 ORDER BY product_id',
      [o.id],
    )
  ).rows;
  for (const i of items) {
    await row(c, 'SELECT id FROM products WHERE id=$1 FOR UPDATE', [
      i.product_id,
    ]);
    await movement(
      c,
      i.product_id,
      o,
      admin,
      action === 'fulfilled' ? -i.quantity : 0,
      -i.quantity,
      action,
    );
  }
  await c.query('UPDATE orders SET inventory_state=$2 WHERE id=$1', [
    o.id,
    action,
  ]);
}
export async function expire(c, limit = 100) {
  const orders = (
    await c.query(
      "SELECT * FROM orders WHERE inventory_state='reserved' AND verified_cents=0 AND reservation_expires_at<now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1",
      [integer(limit, 'expiry batch', 1, 100)],
    )
  ).rows;
  for (const o of orders) {
    const pending = await row(
      c,
      "SELECT id FROM payments WHERE order_id=$1 AND state IN ('pending','clarification') LIMIT 1",
      [o.id],
    );
    if (pending) continue;
    await inventory(c, o, 'released');
    await c.query("UPDATE orders SET status='expired' WHERE id=$1", [o.id]);
    await history(c, o, 'Reservation expired');
  }
  return orders.length;
}
export async function products(c, params = {}, admin = false) {
  await expire(c);
  const q = String(params.q || '').slice(0, 100);
  const category = String(params.category || '').slice(0, 100);
  const sort =
    {
      price_asc: 'p.price_cents ASC,p.id',
      price_desc: 'p.price_cents DESC,p.id',
      name: 'p.name,p.id',
      newest: 'p.created_at DESC,p.id',
    }[
      Object.hasOwn(
        { price_asc: 1, price_desc: 1, name: 1, newest: 1 },
        params.sort,
      )
        ? params.sort
        : ''
    ] || 'p.featured DESC,p.name,p.id';
  const page = Math.trunc(
    Math.max(1, Math.min(10000, Number(params.page) || 1)),
  );
  const rows = (
    await c.query(
      `SELECT p.*,c.name category, (p.stock-p.reserved) available, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'alt',m.alt) ORDER BY m.created_at) FROM media m WHERE m.product_id=p.id AND NOT m.private),'[]') images, count(*) OVER() total_count FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ($1 OR (p.published AND NOT p.archived)) AND (p.name ILIKE $2 OR p.sku ILIKE $2) AND ($3='' OR c.name=$3) AND ($5='' OR p.slug=$5) ORDER BY ${sort} LIMIT 24 OFFSET $4`,
      [
        admin,
        '%' + q + '%',
        category,
        (page - 1) * 24,
        String(params.slug || '').slice(0, 100),
      ],
    )
  ).rows;
  return {
    items: rows.map((p) => ({ ...p, price_cents: Number(p.price_cents) })),
    total: Number(rows[0]?.total_count || 0),
    page,
  };
}
export async function saveProduct(c, b, admin) {
  const productId = b.id ? uuid(b.id) : id();
  let categoryId = null;
  const category = text(b.category, 'category', 100);
  const categoryRow = await row(
    c,
    'INSERT INTO categories(id,name) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id',
    [id(), category],
  );
  categoryId = categoryRow.id;
  const name = text(b.name, 'product name', 150),
    slug = text(b.slug, 'slug', 100),
    sku = text(b.sku, 'SKU', 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    fail('Use lowercase letters, numbers and hyphens in the slug.');
  const min = integer(b.min_quantity ?? 1, 'minimum quantity', 1);
  const max = integer(b.max_quantity ?? 100, 'maximum quantity', min);
  const values = [
    productId,
    slug,
    sku,
    name,
    categoryId,
    text(b.description ?? '', 'description', 6000, false),
    text(b.short_description ?? '', 'short description', 300, false),
    text(b.unit, 'unit', 80),
    cents(b.price),
    min,
    max,
    integer(b.low_stock ?? 5, 'low stock threshold'),
    b.published === true,
    b.featured === true,
    b.unavailable === true,
    b.archived === true,
    text(b.handling ?? '', 'handling', 500, false),
    text(b.variant ?? '', 'variant', 100, false),
  ];
  await c.query(
    `INSERT INTO products(id,slug,sku,name,category_id,description,short_description,unit,price_cents,min_quantity,max_quantity,low_stock,published,featured,unavailable,archived,handling,variant) VALUES(${values.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,sku=excluded.sku,name=excluded.name,category_id=excluded.category_id,description=excluded.description,short_description=excluded.short_description,unit=excluded.unit,price_cents=excluded.price_cents,min_quantity=excluded.min_quantity,max_quantity=excluded.max_quantity,low_stock=excluded.low_stock,published=excluded.published,featured=excluded.featured,unavailable=excluded.unavailable,archived=excluded.archived,handling=excluded.handling,variant=excluded.variant,updated_at=now()`,
    values,
  );
  await audit(c, admin, 'product saved', productId, {
    name,
    price_cents: values[8],
  });
  return row(c, 'SELECT * FROM products WHERE id=$1', [productId]);
}
export async function adjustStock(c, b, admin) {
  const p = await row(c, 'SELECT * FROM products WHERE id=$1 FOR UPDATE', [
    uuid(b.product_id),
  ]);
  if (!p) fail('Product not found.', 404);
  const stock = integer(b.stock, 'stock', 0, 1000000);
  if (stock < p.reserved)
    fail('Stock cannot be lower than reserved quantity.', 409);
  const reason = text(b.reason, 'adjustment reason', 500);
  await movement(c, p.id, null, admin, stock - p.stock, 0, reason);
  await audit(c, admin, 'stock adjusted', p.id, {
    previous: p.stock,
    stock,
    reason,
  });
  return row(c, 'SELECT * FROM products WHERE id=$1', [p.id]);
}
export async function cartQuote(c, items) {
  if (!Array.isArray(items) || !items.length || items.length > 30)
    fail('Add between one and thirty different products.');
  const seen = new Set();
  const normalized = items
    .map((i) => ({
      product_id: uuid(i.product_id),
      quantity: integer(i.quantity, 'quantity', 1),
    }))
    .sort((a, b) => a.product_id.localeCompare(b.product_id));
  const lines = [];
  for (const i of normalized) {
    if (seen.has(i.product_id)) fail('Combine duplicate cart products.');
    seen.add(i.product_id);
    const p = await row(c, 'SELECT * FROM products WHERE id=$1 FOR UPDATE', [
      i.product_id,
    ]);
    if (!p || !p.published || p.archived || p.unavailable)
      fail('A product is no longer available. Review your cart.', 409);
    if (i.quantity < p.min_quantity || i.quantity > p.max_quantity)
      fail(`${p.name}: order ${p.min_quantity}–${p.max_quantity} units.`, 409);
    if (i.quantity > p.stock - p.reserved)
      fail(
        `${p.name}: only ${p.stock - p.reserved} available. Review your cart.`,
        409,
      );
    lines.push({
      ...i,
      name: p.name,
      sku: p.sku,
      variant: p.variant,
      unit: p.unit,
      unit_price_cents: Number(p.price_cents),
      line_cents: Number(p.price_cents) * i.quantity,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.line_cents, 0);
  if (subtotal <= 0 || subtotal > 1000000000)
    fail('Order value is outside supported limits.');
  return {
    items: lines,
    subtotal_cents: subtotal,
    deposit_cents: Math.ceil(subtotal / 2),
    transport_cents: null,
  };
}
export async function placeOrder(c, b, key) {
  if (!checkoutEnabled())
    fail(
      'Checkout is not open yet. Please contact Herb-All about availability.',
      503,
    );
  text(key, 'submission key', 100);
  if (!/^[a-zA-Z0-9_-]{24,100}$/.test(key)) fail('Invalid submission key.');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    hash(key),
  ]);
  const existing = await row(
    c,
    'SELECT * FROM orders WHERE idempotency_hash=$1',
    [hash(key)],
  );
  const requestHash = hash(JSON.stringify(b));
  if (existing) {
    if (existing.request_hash !== requestHash)
      fail('This submission key was already used for another order.', 409);
    return {
      order: await detail(c, existing),
      tracking_token: accessToken(key),
    };
  }
  await expire(c);
  const s = await settings(c);
  if (b.delivery_method === 'collection' && !s.collection_enabled)
    fail('Farm collection is not currently enabled.');
  if (!['delivery', 'collection'].includes(b.delivery_method))
    fail('Choose a delivery method.');
  const customer = {
    name: text(b.name, 'full name', 150),
    phone: phone(b.phone),
    email: text(b.email ?? '', 'email', 254, false),
    notes: text(b.notes ?? '', 'notes', 1000, false),
  };
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
    fail('Check email address.');
  const dest =
    b.delivery_method === 'delivery'
      ? {
          county: text(b.county, 'county', 100),
          town: text(b.town, 'town', 100),
          estate: text(b.estate, 'estate/location', 200),
          address: text(b.address, 'delivery instructions', 500),
        }
      : { address: 'Farm collection by arrangement' };
  const quote = await cartQuote(c, b.items);
  const orderId = id(),
    reference = 'HA-' + new Date().getUTCFullYear() + '-' + tokenReference();
  const tracking = accessToken(key);
  const o = await row(
    c,
    `INSERT INTO orders(id,reference,token_hash,idempotency_hash,request_hash,customer,delivery_method,destination,subtotal_cents,transport_cents,transport_policy,balance_policy,reservation_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()+($13 * interval '1 hour')) RETURNING *`,
    [
      orderId,
      reference,
      hash(tracking),
      hash(key),
      requestHash,
      customer,
      b.delivery_method,
      dest,
      quote.subtotal_cents,
      b.delivery_method === 'collection' ? 0 : null,
      s.transport_policy,
      s.balance_policy,
      s.reservation_hours,
    ],
  );
  for (const line of quote.items) {
    await c.query(
      'INSERT INTO order_items(id,order_id,product_id,name,sku,variant,unit,unit_price_cents,quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id(),
        o.id,
        line.product_id,
        line.name,
        line.sku,
        line.variant,
        line.unit,
        line.unit_price_cents,
        line.quantity,
      ],
    );
    await movement(
      c,
      line.product_id,
      o,
      null,
      0,
      line.quantity,
      'order reservation',
    );
  }
  await history(c, o, 'Order received');
  return { order: await detail(c, o), tracking_token: tracking };
}
function tokenReference() {
  return id().replaceAll('-', '').slice(0, 12).toUpperCase();
}
export async function customerOrder(c, reference, tracking) {
  if (!tracking || tracking.length > 200)
    fail('Enter the private tracking key supplied with your order.', 403);
  const o = await row(
    c,
    'SELECT * FROM orders WHERE reference=$1 AND token_hash=$2 FOR UPDATE',
    [text(reference, 'order reference', 40), hash(tracking)],
  );
  if (!o) fail('Order or tracking key not found.', 404);
  return o;
}
export async function detail(c, o, admin = false) {
  const s = await settings(c);
  const items = (
    await c.query(
      'SELECT name,sku,variant,unit,quantity,unit_price_cents,product_id FROM order_items WHERE order_id=$1 ORDER BY name',
      [o.id],
    )
  ).rows;
  const payments = (
    await c.query(
      'SELECT id,reference,reported_cents,state,verified_cents,reason,created_at,decided_at' +
        (admin ? ',phone,paid_at,message,attachment_id,decided_by' : '') +
        ' FROM payments WHERE order_id=$1 ORDER BY created_at',
      [o.id],
    )
  ).rows;
  const timeline = (
    await c.query(
      'SELECT event,data,created_at FROM order_history WHERE order_id=$1 ORDER BY created_at',
      [o.id],
    )
  ).rows.filter((e) => admin || !e.event.startsWith('Internal'));
  const eligible =
    o.stock_confirmed &&
    ['reserved', 'fulfilled'].includes(o.inventory_state) &&
    (o.delivery_method === 'collection' || o.transport_cents !== null) &&
    !['cancelled', 'expired', 'refund_pending', 'refunded'].includes(o.status);
  return {
    reference: o.reference,
    id: admin ? o.id : undefined,
    customer: o.customer,
    destination: o.destination,
    delivery_method: o.delivery_method,
    distance_meters: o.distance_meters,
    distance_status: o.distance_status,
    status: o.status,
    stock_confirmed: o.stock_confirmed,
    reservation_expires_at: o.reservation_expires_at,
    inventory_state: o.inventory_state,
    created_at: o.created_at,
    updated_at: o.updated_at,
    subtotal_cents: Number(o.subtotal_cents),
    adjustment_cents: Number(o.adjustment_cents),
    transport_policy: o.transport_policy,
    balance_policy: o.balance_policy,
    refunded_cents: Number(o.refunded_cents),
    ...finance(o),
    items: items.map((i) => ({
      ...i,
      unit_price_cents: Number(i.unit_price_cents),
    })),
    payments,
    timeline,
    payment_available:
      eligible && s.payment_enabled && finance(o).current_due_cents > 0,
    payment_instructions:
      eligible && s.payment_enabled
        ? {
            payee: s.payee,
            phone: s.pochi_phone,
            instructions: s.payment_instructions,
          }
        : null,
  };
}
export async function submitPayment(c, o, b) {
  const s = await settings(c);
  if (
    !s.payment_enabled ||
    !o.stock_confirmed ||
    o.transport_cents === null ||
    !['reserved', 'fulfilled'].includes(o.inventory_state) ||
    [
      'cancelled',
      'expired',
      'refund_pending',
      'refunded',
      'delivered',
    ].includes(o.status)
  )
    fail(
      'Payment is not enabled for this order. Ask Herb-All to confirm its terms.',
      409,
    );
  const ref = text(b.reference, 'M-Pesa transaction code', 20).toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(ref))
    fail('Enter the ten-character M-Pesa transaction code.');
  const amount = cents(b.amount);
  if (!amount) fail('Payment amount must be positive.');
  const paidAt = new Date(b.paid_at);
  if (
    !Number.isFinite(paidAt.valueOf()) ||
    paidAt > new Date(Date.now() + 300000) ||
    paidAt < new Date(Date.now() - 90 * 86400000)
  )
    fail('Check payment date and time.');
  const old = await row(c, 'SELECT * FROM payments WHERE reference=$1', [ref]);
  if (old) {
    if (old.order_id !== o.id)
      fail('This payment reference is already in use. Contact Herb-All.', 409);
    if (['rejected', 'clarification'].includes(old.state)) {
      await history(c, o, 'Payment evidence corrected', null, {
        reference: ref,
        previous_reported_cents: Number(old.reported_cents),
        previous_phone: old.phone,
        previous_paid_at: old.paid_at,
        previous_message: old.message,
        previous_decision: old.state,
        previous_reason: old.reason,
      });
      await c.query(
        "UPDATE payments SET reported_cents=$2,phone=$3,paid_at=$4,message=$5,state='pending' WHERE id=$1",
        [
          old.id,
          amount,
          phone(b.phone),
          paidAt,
          text(b.message ?? '', 'payment details', 1000, false),
        ],
      );
      await c.query(
        "UPDATE orders SET status=CASE WHEN status IN ('preparing','dispatched') THEN status ELSE 'verification_pending' END WHERE id=$1",
        [o.id],
      );
    } else if (
      Number(old.reported_cents) !== amount ||
      old.phone !== phone(b.phone)
    )
      fail('This payment reference is already in use. Contact Herb-All.', 409);
    return {
      ...(await detail(
        c,
        await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]),
      )),
      submitted_payment_id: old.id,
    };
  }
  const p = await row(
    c,
    'INSERT INTO payments(id,order_id,reference,reported_cents,phone,paid_at,message) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [
      id(),
      o.id,
      ref,
      amount,
      phone(b.phone),
      paidAt,
      text(b.message ?? '', 'payment details', 1000, false),
    ],
  );
  await c.query(
    "UPDATE orders SET status=CASE WHEN status IN ('preparing','dispatched') THEN status ELSE 'verification_pending' END WHERE id=$1",
    [o.id],
  );
  await history(
    c,
    o,
    'Payment submitted — awaiting Herb-All verification',
    null,
    { reference: ref },
  );
  return {
    ...(await detail(
      c,
      await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]),
    )),
    submitted_payment_id: p.id,
  };
}
export async function decidePayment(c, b, admin) {
  const p0 = await row(c, 'SELECT order_id FROM payments WHERE id=$1', [
    uuid(b.payment_id),
  ]);
  if (!p0) fail('Payment not found.', 404);
  const o = await row(c, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [
    p0.order_id,
  ]);
  const p = await row(c, 'SELECT * FROM payments WHERE id=$1 FOR UPDATE', [
    b.payment_id,
  ]);
  if (p.state === 'verified') {
    if (b.decision === 'verified') return detail(c, o, true);
    fail('Verified payment history cannot be overwritten.', 409);
  }
  const decision = text(b.decision, 'decision', 30);
  if (!['verified', 'rejected', 'clarification'].includes(decision))
    fail('Invalid payment decision.');
  const reason = text(b.reason, 'verification reason', 500);
  let amount = null;
  if (decision === 'verified') {
    amount = cents(b.verified_amount);
    if (!amount) fail('Verified amount must be positive.');
    if (b.confirmed !== true)
      fail(
        'Confirm that the transaction was independently checked in the business account.',
      );
    await c.query(
      'UPDATE orders SET verified_cents=verified_cents+$2 WHERE id=$1',
      [o.id, amount],
    );
  }
  await c.query(
    'UPDATE payments SET state=$2,verified_cents=$3,decided_by=$4,decided_at=now(),reason=$5 WHERE id=$1',
    [p.id, decision, amount, admin.id, reason],
  );
  const fresh = await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]);
  const f = finance(fresh);
  const state =
    decision === 'verified' &&
    (o.inventory_state === 'released' ||
      ['cancelled', 'expired', 'refunded'].includes(o.status))
      ? 'refund_pending'
      : [
            'preparing',
            'dispatched',
            'cancelled',
            'expired',
            'refund_pending',
            'refunded',
            'delivered',
          ].includes(o.status)
        ? o.status
        : decision === 'verified'
          ? f.deposit_outstanding_cents === 0
            ? 'deposit_confirmed'
            : 'awaiting_additional_payment'
          : decision === 'rejected'
            ? 'payment_rejected'
            : 'verification_pending';
  await c.query('UPDATE orders SET status=$2 WHERE id=$1', [o.id, state]);
  await history(c, o, 'Payment ' + decision, admin, {
    reference: p.reference,
    amount_cents: amount,
    reason,
  });
  await audit(c, admin, 'payment ' + decision, p.id, {
    reference: p.reference,
    amount_cents: amount,
    reason,
  });
  return detail(
    c,
    await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]),
    true,
  );
}
export async function orderAction(c, o, b, admin) {
  const action = b.action,
    reason = text(b.reason ?? '', 'reason/notes', 1000, false);
  const ended = [
    'cancelled',
    'expired',
    'refunded',
    'refund_pending',
    'delivered',
  ].includes(o.status);
  if (action === 'communicated') {
    if (
      !['email', 'phone', 'whatsapp', 'in_person'].includes(b.channel) ||
      !reason
    )
      fail('Select communication channel and enter notes.');
    await history(c, o, 'Update communicated', admin, {
      channel: b.channel,
      notes: reason,
    });
  } else if (action === 'note') {
    if (!reason) fail('Enter an internal note.');
    await history(c, o, 'Internal note', admin, { notes: reason });
  } else if (action === 'confirm_stock') {
    if (o.status !== 'awaiting_stock' || o.inventory_state !== 'reserved')
      fail('Stock confirmation requires a new active reservation.', 409);
    await c.query(
      "UPDATE orders SET stock_confirmed=true,status=CASE WHEN transport_cents IS NULL THEN 'awaiting_transport' ELSE 'awaiting_deposit' END WHERE id=$1",
      [o.id],
    );
    await history(c, o, 'Stock confirmed', admin);
  } else if (action === 'quote' || action === 'adjust') {
    if (
      ended ||
      Number(o.verified_cents) > 0 ||
      (await row(c, 'SELECT id FROM payments WHERE order_id=$1 LIMIT 1', [
        o.id,
      ]))
    )
      fail(
        'Financial terms are frozen once evidence is submitted. Reconcile before changing an order.',
        409,
      );
    if (!reason) fail('Explain the financial change.');
    if (action === 'quote') {
      if (o.delivery_method !== 'delivery')
        fail('Collection does not require a transport quote.');
      const fee = cents(b.fee);
      if (!['upfront', 'delivery'].includes(b.policy))
        fail('Choose transport payment policy.');
      await c.query(
        "UPDATE orders SET transport_cents=$2,transport_policy=$3,status=CASE WHEN stock_confirmed THEN 'awaiting_deposit' ELSE status END WHERE id=$1",
        [o.id, fee, b.policy],
      );
      await history(c, o, 'Transport quotation confirmed', admin, {
        fee_cents: fee,
        policy: b.policy,
        notes: reason,
      });
    } else {
      const amount = cents(b.amount);
      const adjustment = b.direction === 'discount' ? -amount : amount;
      if (Number(o.subtotal_cents) + adjustment <= 0)
        fail('Adjusted merchandise total must be positive.');
      await c.query('UPDATE orders SET adjustment_cents=$2 WHERE id=$1', [
        o.id,
        adjustment,
      ]);
      await history(c, o, 'Merchandise terms revised', admin, {
        adjustment_cents: adjustment,
        notes: reason,
      });
    }
  } else if (action === 'cancel') {
    if (['dispatched', 'delivered', 'refunded'].includes(o.status))
      fail('This order cannot be cancelled.', 409);
    if (!reason) fail('Enter cancellation reason.');
    await inventory(c, o, 'released', admin);
    const hasPayment =
      Number(o.verified_cents) > Number(o.refunded_cents) ||
      (await row(
        c,
        "SELECT id FROM payments WHERE order_id=$1 AND state IN ('pending','clarification') LIMIT 1",
        [o.id],
      ));
    await c.query('UPDATE orders SET status=$2 WHERE id=$1', [
      o.id,
      hasPayment ? 'refund_pending' : 'cancelled',
    ]);
    await history(c, o, 'Order cancelled', admin, { reason });
  } else if (action === 'prepare') {
    if (
      ![
        'deposit_confirmed',
        'awaiting_additional_payment',
        'preparing',
      ].includes(o.status) ||
      finance(o).deposit_outstanding_cents > 0 ||
      !o.stock_confirmed ||
      o.transport_cents === null
    )
      fail('Stock, quotation and verified deposit are required.', 409);
    await c.query("UPDATE orders SET status='preparing' WHERE id=$1", [o.id]);
    await history(c, o, 'Preparing order', admin);
  } else if (action === 'dispatch') {
    if (
      o.status !== 'preparing' ||
      finance(o).dispatch_due_cents > 0 ||
      o.transport_cents === null
    )
      fail(
        'Prepare the order and satisfy its payment conditions before dispatch.',
        409,
      );
    if (!reason) fail('Enter dispatch or collection details.');
    await inventory(c, o, 'fulfilled', admin);
    await c.query("UPDATE orders SET status='dispatched' WHERE id=$1", [o.id]);
    await history(c, o, 'Dispatched', admin, { details: reason });
  } else if (action === 'deliver') {
    if (o.status !== 'dispatched' || finance(o).outstanding_cents > 0)
      fail(
        'Dispatch and verify the remaining balance before completing delivery.',
        409,
      );
    await c.query("UPDATE orders SET status='delivered' WHERE id=$1", [o.id]);
    await history(c, o, 'Delivered', admin, { details: reason });
  } else fail('Unknown order action.');
  await audit(c, admin, 'order ' + action, o.id, { reason });
  return detail(
    c,
    await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]),
    true,
  );
}
export async function refund(c, o, b, admin) {
  const refundable =
    o.status === 'refund_pending'
      ? Number(o.verified_cents) - Number(o.refunded_cents)
      : finance(o).overpayment_cents;
  if (!refundable) fail('No verified refundable balance is available.', 409);
  const amount = cents(b.amount);
  if (!amount || amount > refundable)
    fail('Refund exceeds the verified refundable balance.');
  const reason = text(b.reason, 'refund reference and reason', 1000);
  if (b.confirmed !== true)
    fail('Confirm the refund was actually completed outside this website.');
  await c.query(
    "UPDATE orders SET refunded_cents=refunded_cents+$2,status=CASE WHEN status='refund_pending' THEN CASE WHEN refunded_cents+$2=verified_cents THEN 'refunded' ELSE 'refund_pending' END ELSE status END WHERE id=$1",
    [o.id, amount],
  );
  await history(c, o, 'Refund recorded', admin, {
    amount_cents: amount,
    reason,
  });
  await audit(c, admin, 'refund recorded', o.id, {
    amount_cents: amount,
    reason,
  });
  return detail(
    c,
    await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]),
    true,
  );
}
