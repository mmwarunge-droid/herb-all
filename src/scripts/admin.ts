export {};
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const money = (v: any) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    currencyDisplay: 'code',
  }).format(Number(v) / 100);
const root = document.querySelector('#admin-content')!;
const status = document.querySelector('#commerce-status')!;
let user: any;
const note = (s: string) => (status.textContent = s);
const pendingWrites = new Map<string, string>();
async function api(path: string, body?: unknown, method?: string) {
  const fingerprint = path + ':' + JSON.stringify(body);
  const key = body
    ? pendingWrites.get(fingerprint) || crypto.randomUUID().replaceAll('-', '')
    : '';
  if (body) pendingWrites.set(fingerprint, key);
  const r = await fetch('/api/' + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body
      ? {
          'Content-Type': 'application/json',
          'X-CSRF-Token': user?.csrf || '',
          'Idempotency-Key': key,
        }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed.');
  pendingWrites.delete(fingerprint);
  return d;
}
const input = (
  name: string,
  label: string,
  value: unknown = '',
  type = 'text',
  required = true,
) =>
  `<label for="a-${name}">${label}</label><input id="a-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''}/>`;
const check = (name: string, label: string, checked = false) =>
  `<label class="check-label"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''}/> ${label}</label>`;
const select = (name: string, label: string, values: string[], value = '') =>
  `<label for="a-${name}">${label}</label><select id="a-${name}" name="${name}">${values.map((v) => `<option ${v === value ? 'selected' : ''} value="${v}">${v.replaceAll('_', ' ')}</option>`).join('')}</select>`;
function formData(f: HTMLFormElement) {
  const d: any = Object.fromEntries(new FormData(f));
  f.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(
    (i) => (d[i.name] = i.checked),
  );
  return d;
}
function actionForm(id: string, title: string, fields: string, button = title) {
  const scoped = fields.replace(/(?:id|for)="([^"]+)"/g, (m, v) =>
    m.replace(v, id + '-' + v),
  );
  return `<form id="${id}" class="contact-form"><h3>${title}</h3>${scoped}<button class="button">${button}</button></form>`;
}
function bind(
  id: string,
  path: string,
  transform: (d: any) => any = (d) => d,
  after: () => Promise<any> = dashboard,
  confirm = false,
) {
  const f = document.querySelector<HTMLFormElement>('#' + id);
  if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (
      confirm &&
      !window.confirm(
        'Confirm this change? Financial and stock actions are recorded in the audit history.',
      )
    )
      return;
    const btn = f.querySelector<HTMLButtonElement>('button')!;
    btn.disabled = true;
    try {
      await api(path, transform(formData(f)));
      note('Saved successfully.');
      await after();
    } catch (error) {
      note((error as Error).message);
      btn.disabled = false;
    }
  };
}
function permitted(p: string) {
  return user.role === 'super' || user.role === p;
}
function frame(html: string) {
  root.innerHTML = `<div class="admin-toolbar"><p>${esc(user.email)} · ${esc(user.role)}</p><button class="button outline" id="logout">Log out</button></div><nav class="admin-tabs" aria-label="Administration"><button data-view="dashboard">Dashboard</button>${permitted('inventory') ? '<button data-view="products">Products & stock</button>' : ''}${permitted('orders') || permitted('payments') ? '<button data-view="orders">Orders</button>' : ''}${permitted('payments') ? '<button data-view="payments">Payment queue</button>' : ''}${user.role === 'super' ? '<button data-view="settings">Business settings</button><button data-view="accounts">Accounts</button>' : ''}</nav><div id="admin-view">${html}</div>`;
  (document.querySelector('#logout') as HTMLButtonElement).onclick =
    async () => {
      try {
        await api('auth/logout', {});
        location.reload();
      } catch (e) {
        note((e as Error).message);
      }
    };
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach(
      (btn) =>
        (btn.onclick = () =>
          views[btn.dataset.view!]().catch((e: Error) => note(e.message))),
    );
}
async function dashboard() {
  const d = await api('admin/dashboard');
  frame(
    `<h2>Operational overview</h2><div class="dashboard-grid">${
      d.inventory
        ? Object.entries(d.inventory)
            .map(
              ([k, v]) =>
                `<div class="order-panel"><h3>${esc(k.replaceAll('_', ' '))}</h3><strong>${esc(v)}</strong></div>`,
            )
            .join('')
        : ''
    }${(d.orders || []).map((s: any) => `<div class="order-panel"><h3>${esc(s.status.replaceAll('_', ' '))}</h3><strong>${s.count}</strong></div>`).join('')}${d.pending_payments !== undefined ? `<div class="order-panel"><h3>Payments awaiting verification</h3><strong>${d.pending_payments}</strong></div>` : ''}</div><h3>Recent activity</h3>${d.activity.map((a: any) => `<p>${esc(a.action)} · ${esc(new Date(a.created_at).toLocaleString())}</p>`).join('') || '<p>No activity yet. Use Products to build the actual sale catalogue.</p>'}`,
  );
}
function productForm(p: any = {}) {
  return actionForm(
    'product-form',
    p.id ? 'Edit product' : 'Create product',
    `<input type="hidden" name="id" value="${esc(p.id || '')}"/>` +
      input('name', 'Product name', p.name) +
      input('slug', 'URL slug', p.slug) +
      input('sku', 'SKU', p.sku) +
      input('category', 'Category', p.category) +
      input('unit', 'Unit of sale', p.unit) +
      input(
        'price',
        'Unit price (KES)',
        p.price_cents !== undefined ? (p.price_cents / 100).toFixed(2) : '',
      ) +
      input(
        'variant',
        'Variant / size / variety (optional)',
        p.variant,
        'text',
        false,
      ) +
      input(
        'short_description',
        'Short description',
        p.short_description,
        'text',
        false,
      ) +
      `<label for="a-description">Detailed description</label><textarea id="a-description" name="description" maxlength="6000">${esc(p.description)}</textarea>` +
      input(
        'handling',
        'Weight / handling notes (optional)',
        p.handling,
        'text',
        false,
      ) +
      input('min_quantity', 'Minimum quantity', p.min_quantity ?? 1, 'number') +
      input(
        'max_quantity',
        'Maximum quantity',
        p.max_quantity ?? 100,
        'number',
      ) +
      input('low_stock', 'Low stock threshold', p.low_stock ?? 5, 'number') +
      check('published', 'Published', p.published) +
      check('featured', 'Featured', p.featured) +
      check('unavailable', 'Temporarily unavailable', p.unavailable) +
      check('archived', 'Archived (keeps historical orders)', p.archived),
  );
}
async function products() {
  const d = await api('admin/products');
  frame(
    `<h2>Products & inventory</h2><p>Each optional variety or pack size can have its own SKU and independent stock. New products start with zero stock. Publishing never invents quantities.</p><form id="product-search" class="filters">${input('q', 'Search name or SKU', '', 'search', false)}<button class="button">Search</button></form><div id="product-list">${productList(d.items)}</div><div id="product-pages" class="actions"></div><button class="button outline" id="new-product">Create product</button><div id="product-editor">${productForm()}</div><div id="stock-history"></div>`,
  );
  bindProduct();
  (document.querySelector('#new-product') as HTMLButtonElement).onclick =
    () => {
      document.querySelector('#product-editor')!.innerHTML = productForm();
      bindProduct();
    };
  const setup = () =>
    document.querySelectorAll<HTMLButtonElement>('[data-edit-product]').forEach(
      (btn) =>
        (btn.onclick = async () => {
          const p = JSON.parse(btn.dataset.editProduct!);
          document.querySelector('#product-editor')!.innerHTML =
            productForm(p) +
            actionForm(
              'stock-form',
              'Adjust stock',
              `<input name="product_id" type="hidden" value="${p.id}"/>` +
                input(
                  'stock',
                  'Total physical stock (including reserved)',
                  p.stock,
                  'number',
                ) +
                `<p>Reserved: ${p.reserved}. Available: ${p.available}.</p>` +
                input('reason', 'Adjustment reason'),
            ) +
            actionForm(
              'image-form',
              'Upload product photograph',
              `<input name="product_id" type="hidden" value="${p.id}"/>` +
                input('alt', 'Describe the photograph') +
                '<label for="product-image">JPEG, PNG or WebP; maximum 2 MB</label><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" required/>',
            ) +
            `<div class="product-gallery">${p.images.map((m: any) => `<div><img src="/api/media/${m.id}" alt="${esc(m.alt)}" width="200" height="200"/><button data-delete-image="${m.id}" class="button outline">Remove image</button></div>`).join('')}</div>`;
          bindProduct();
          bind(
            'stock-form',
            'admin/stock',
            (d) => ({ ...d, stock: Number(d.stock) }),
            products,
            true,
          );
          document.querySelector<HTMLFormElement>('#image-form')!.onsubmit =
            async (e) => {
              e.preventDefault();
              const f = e.currentTarget as HTMLFormElement;
              try {
                const file = (
                  document.querySelector(
                    '#image-form-product-image',
                  ) as HTMLInputElement
                ).files![0];
                if (file.size > 2097152)
                  throw new Error('Choose an image under 2 MB.');
                let raw = '';
                new Uint8Array(await file.arrayBuffer()).forEach(
                  (v) => (raw += String.fromCharCode(v)),
                );
                await api('admin/image', { ...formData(f), data: btoa(raw) });
                await products();
                note('Image uploaded.');
              } catch (error) {
                note((error as Error).message);
              }
            };
          document
            .querySelectorAll<HTMLButtonElement>('[data-delete-image]')
            .forEach(
              (button) =>
                (button.onclick = async () => {
                  if (!confirm('Remove this product photograph?')) return;
                  try {
                    await api(
                      'admin/image',
                      { id: button.dataset.deleteImage },
                      'DELETE',
                    );
                    await products();
                  } catch (e) {
                    note((e as Error).message);
                  }
                }),
            );
          document.querySelector('#product-editor')!.scrollIntoView();
        }),
    );
  const drawProducts = (result: any) => {
    document.querySelector('#product-list')!.innerHTML = productList(
      result.items,
    );
    setup();
    const pager = document.querySelector('#product-pages')!;
    pager.innerHTML =
      result.total > 24
        ? `<button class="button outline" data-product-page="${result.page - 1}" ${result.page <= 1 ? 'disabled' : ''}>Previous products</button><span>Page ${result.page}</span><button class="button outline" data-product-page="${result.page + 1}" ${result.page * 24 >= result.total ? 'disabled' : ''}>Next products</button>`
        : '';
    pager.querySelectorAll<HTMLButtonElement>('[data-product-page]').forEach(
      (btn) =>
        (btn.onclick = async () => {
          try {
            const q = String(
              new FormData(
                document.querySelector('#product-search') as HTMLFormElement,
              ).get('q') || '',
            );
            drawProducts(
              await api(
                'admin/products?q=' +
                  encodeURIComponent(q) +
                  '&page=' +
                  btn.dataset.productPage,
              ),
            );
          } catch (e) {
            note((e as Error).message);
          }
        }),
    );
  };
  drawProducts(d);
  document.querySelector<HTMLFormElement>('#product-search')!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    try {
      const q = new FormData(e.currentTarget as HTMLFormElement).get('q');
      const result = await api(
        'admin/products?q=' + encodeURIComponent(String(q)),
      );
      drawProducts(result);
    } catch (error) {
      note((error as Error).message);
    }
  };
  const history = await api('admin/inventory');
  document.querySelector('#stock-history')!.innerHTML =
    '<h3>Recent stock movements</h3>' +
    history
      .map(
        (m: any) =>
          `<p>${esc(m.name)} · physical ${m.stock_delta}, reserved ${m.reserved_delta} · ${esc(m.reason)} · ${esc(new Date(m.created_at).toLocaleString())} · administrator ${esc(m.administrator_id || 'system/customer')}</p>`,
      )
      .join('');
}
function productList(items: any[]) {
  return items.length
    ? items
        .map(
          (p) =>
            `<div class="cart-row"><strong>${esc(p.name)} (${esc(p.sku)})</strong><span>${money(p.price_cents)} · stock ${p.stock}, reserved ${p.reserved}, available ${p.available} · ${p.archived ? 'archived' : p.published ? 'published' : 'draft'}</span><button class="button outline" data-edit-product="${esc(JSON.stringify(p))}">Edit ${esc(p.name)}</button></div>`,
        )
        .join('')
    : '<p>No matching products. Create the first approved product below.</p>';
}
function bindProduct() {
  bind(
    'product-form',
    'admin/products',
    (d) => ({
      ...d,
      id: d.id || undefined,
      min_quantity: Number(d.min_quantity),
      max_quantity: Number(d.max_quantity),
      low_stock: Number(d.low_stock),
    }),
    products,
    true,
  );
}
async function orders() {
  frame(
    '<h2>Customer orders</h2><form id="order-search" class="filters">' +
      input('q', 'Order reference, name or phone', '', 'search', false) +
      select('status', 'Status', [
        '',
        'awaiting_stock',
        'awaiting_transport',
        'awaiting_deposit',
        'verification_pending',
        'deposit_confirmed',
        'awaiting_additional_payment',
        'payment_rejected',
        'preparing',
        'dispatched',
        'delivered',
        'cancelled',
        'expired',
        'refund_pending',
        'refunded',
      ]) +
      input('from', 'From date', '', 'date', false) +
      input('to', 'To date', '', 'date', false) +
      '<button class="button">Search orders</button></form><div id="orders-list"></div><div id="order-pages" class="actions"></div><div id="order-detail"></div>',
  );
  const load = async (page = 1) => {
    const params = new URLSearchParams(
      new FormData(
        document.querySelector('#order-search') as HTMLFormElement,
      ) as any,
    );
    params.set('page', String(page));
    const d = await api('admin/orders?' + params);
    const count = Number(d[0]?.total_count || 0),
      pager = document.querySelector('#order-pages')!;
    pager.innerHTML =
      count > 50
        ? `<button class="button outline" data-order-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous orders</button><span>Page ${page}</span><button class="button outline" data-order-page="${page + 1}" ${page * 50 >= count ? 'disabled' : ''}>Next orders</button>`
        : '';
    pager
      .querySelectorAll<HTMLButtonElement>('[data-order-page]')
      .forEach(
        (btn) =>
          (btn.onclick = () =>
            load(Number(btn.dataset.orderPage)).catch((e) => note(e.message))),
      );
    document.querySelector('#orders-list')!.innerHTML =
      d
        .map(
          (o: any) =>
            `<div class="cart-row"><strong>${esc(o.reference)}</strong><span>${esc(o.customer.name)} · ${esc(o.status)} · ${money(o.subtotal_cents)}</span><button class="button outline" data-order="${esc(o.reference)}">Open ${esc(o.reference)}</button></div>`,
        )
        .join('') || '<p>No matching orders.</p>';
    document
      .querySelectorAll<HTMLButtonElement>('[data-order]')
      .forEach(
        (btn) =>
          (btn.onclick = () =>
            showOrder(btn.dataset.order!).catch((e) => note(e.message))),
      );
  };
  document.querySelector<HTMLFormElement>('#order-search')!.onsubmit = (e) => {
    e.preventDefault();
    load().catch((e) => note(e.message));
  };
  await load();
}
async function showOrder(reference: string) {
  const o = await api('admin/order?reference=' + encodeURIComponent(reference));
  const target = document.querySelector('#order-detail')!;
  target.innerHTML = `<section class="order-panel"><h2>${esc(o.reference)} · ${esc(o.status)}</h2><p>${esc(o.customer.name)} · ${esc(o.customer.phone)} · ${esc(o.customer.email)}</p><p>Customer notes: ${esc(o.customer.notes)}</p><p>Destination: ${esc(Object.values(o.destination).join(', '))}</p><p>Merchandise ${money(o.merchandise_cents)}; adjustment ${money(o.adjustment_cents)}; deposit ${money(o.deposit_cents)}; transport ${o.transport_cents === null ? 'pending' : money(o.transport_cents)} (${esc(o.transport_policy)}); total ${o.total_cents === null ? 'pending transport' : money(o.total_cents)}; verified net ${money(o.paid_cents)}; overpayment ${money(o.overpayment_cents)}; currently due ${money(o.current_due_cents)}; refunded ${money(o.refunded_cents)}; outstanding ${money(o.outstanding_cents)}.</p><p>Distance: ${o.distance_meters === null ? 'manual address review' : (o.distance_meters / 1000).toFixed(1) + ' km road estimate'} (${esc(o.distance_status)}). Reservation: ${esc(o.reservation_expires_at)} · ${esc(o.inventory_state)}</p><ul>${o.items.map((i: any) => `<li>${esc(i.name)} · ${esc(i.sku)} · ${i.quantity} × ${money(i.unit_price_cents)}</li>`).join('')}</ul><h3>History</h3>${o.timeline.map((h: any) => `<p>${esc(h.event)} · ${esc(JSON.stringify(h.data))} · ${esc(new Date(h.created_at).toLocaleString())}</p>`).join('')}<h3>Payment attempts</h3>${o.payments.map((p: any) => `<p>${esc(p.reference)} · ${money(p.reported_cents)} · ${esc(p.state)} · ${esc(p.reason)} · verifier ${esc(p.decided_by || 'pending')}</p>`).join('') || '<p>No evidence submitted.</p>'}</section>`;
  if (permitted('orders')) {
    target.innerHTML +=
      actionForm(
        'order-action',
        'Order operations',
        select('action', 'Action', [
          'confirm_stock',
          'prepare',
          'dispatch',
          'deliver',
          'cancel',
          'communicated',
          'note',
        ]) +
          select('channel', 'Communication channel', [
            'phone',
            'email',
            'whatsapp',
            'in_person',
          ]) +
          input(
            'reason',
            'Notes / reason / dispatch details',
            '',
            'text',
            false,
          ),
      ) +
      actionForm(
        'quote-form',
        'Confirm transport quotation',
        input('fee', 'Transport fee (KES)') +
          select(
            'policy',
            'Transport payment policy',
            ['upfront', 'delivery'],
            o.transport_policy,
          ) +
          input('reason', 'Quotation notes'),
      ) +
      actionForm(
        'adjust-form',
        'Revise merchandise terms before payment',
        input('amount', 'Adjustment amount (KES)') +
          select('direction', 'Adjustment', ['discount', 'surcharge']) +
          input('reason', 'Reason for adjustment'),
      ) +
      '<button class="button outline" id="distance-estimate">Estimate road distance</button>';
    const after = () => showOrder(reference);
    bind(
      'order-action',
      'admin/order',
      (d) => ({ ...d, reference }),
      after,
      true,
    );
    bind(
      'quote-form',
      'admin/order',
      (d) => ({ ...d, reference, action: 'quote' }),
      after,
      true,
    );
    bind(
      'adjust-form',
      'admin/order',
      (d) => ({ ...d, reference, action: 'adjust' }),
      after,
      true,
    );
    document.querySelector<HTMLButtonElement>('#distance-estimate')!.onclick =
      async () => {
        try {
          const result = await api('admin/distance', { reference });
          await after();
          note(
            result.status === 'estimated_road'
              ? 'Road estimate updated; confirm the transport fee separately.'
              : 'Maps not available. Review the written destination and quote manually.',
          );
        } catch (e) {
          note((e as Error).message);
        }
      };
  }
  if (
    permitted('payments') &&
    (o.status === 'refund_pending' || o.overpayment_cents > 0)
  ) {
    target.innerHTML += actionForm(
      'refund-form',
      'Record completed external refund',
      input('amount', 'Refund amount (KES)') +
        input('reason', 'Refund transaction reference / reason') +
        check('confirmed', 'I checked that the refund was actually completed'),
    );
    bind(
      'refund-form',
      'admin/refund',
      (d) => ({ ...d, reference }),
      () => showOrder(reference),
      true,
    );
  }
  target.scrollIntoView();
}
async function payments() {
  const list = await api('admin/payments');
  frame(
    '<h2>Payment verification queue</h2><p>Check the actual business M-Pesa account before verifying. A screenshot or code alone is not proof of funds.</p>' +
      list
        .map(
          (p: any) =>
            `<section class="order-panel"><h3>${esc(p.order_reference)} · ${esc(p.reference)}</h3><p>Reported ${money(p.reported_cents)} · ${esc(p.phone)} · ${esc(p.paid_at)}</p><p>${esc(p.message)}</p>${p.attachment_id ? `<a class="text-link" href="/api/media/${p.attachment_id}" target="_blank" rel="noopener noreferrer">View private receipt (new tab)</a>` : ''}<button class="button outline" data-inspect="${esc(p.order_reference)}">Review order financials</button>${actionForm('decision-' + p.id, 'Review ' + p.reference, `<input name="payment_id" type="hidden" value="${p.id}"/>` + select('decision', 'Decision', ['clarification', 'rejected', 'verified']) + input('verified_amount', 'Independently verified amount (KES)', Number(p.reported_cents) / 100) + input('reason', 'Decision reason') + check('confirmed', 'I checked the payment in the business account'))}</section>`,
        )
        .join('') +
      '<div id="order-detail"></div>' +
      (list.length ? '' : '<p>No payments awaiting review.</p>'),
  );
  list.forEach((p: any) =>
    bind(
      'decision-' + p.id,
      'admin/payments/decision',
      (d) => d,
      payments,
      true,
    ),
  );
  document
    .querySelectorAll<HTMLButtonElement>('[data-inspect]')
    .forEach(
      (btn) =>
        (btn.onclick = () =>
          showOrder(btn.dataset.inspect!).catch((e) => note(e.message))),
    );
}
async function settings() {
  const s = await api('admin/settings');
  frame(
    actionForm(
      'settings-form',
      'Business & payment settings',
      check(
        'collection_enabled',
        'Enable farm collection by arrangement',
        s.collection_enabled,
      ) +
        input(
          'reservation_hours',
          'Unpaid reservation hours (1–168)',
          s.reservation_hours,
          'number',
        ) +
        select(
          'transport_policy',
          'Default transport payment policy',
          ['upfront', 'delivery'],
          s.transport_policy,
        ) +
        select(
          'balance_policy',
          'Merchandise balance policy',
          ['before_dispatch', 'delivery'],
          s.balance_policy,
        ) +
        input(
          'payee',
          'Verified Pochi registered payee',
          s.payee,
          'text',
          false,
        ) +
        input(
          'pochi_phone',
          'Verified Pochi phone number',
          s.pochi_phone,
          'tel',
          false,
        ) +
        `<label for="a-payment_instructions">Pochi payment instructions</label><textarea id="a-payment_instructions" name="payment_instructions">${esc(s.payment_instructions)}</textarea>` +
        check(
          'payment_enabled',
          'Enable payment instructions',
          s.payment_enabled,
        ) +
        check(
          'confirmed',
          'I independently verified the Pochi account and these instructions',
        ),
    ),
  );
  bind(
    'settings-form',
    'admin/settings',
    (d) => ({ ...d, reservation_hours: Number(d.reservation_hours) }),
    settings,
    true,
  );
}
async function accounts() {
  const list = await api('admin/accounts');
  frame(
    '<h2>Administrator accounts</h2>' +
      list
        .map(
          (a: any) =>
            `<div class="cart-row"><span>${esc(a.email)} · ${esc(a.role)} · ${a.active ? 'active' : 'disabled'}</span>${a.active && a.id !== user.id ? `<button data-disable="${a.id}" class="button outline">Disable ${esc(a.email)}</button><form data-role-id="${a.id}"><label for="role-${a.id}">Role for ${esc(a.email)}</label><select id="role-${a.id}" name="role">${['super', 'inventory', 'orders', 'payments'].map((role) => `<option value="${role}" ${a.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select><button class="button outline">Save role for ${esc(a.email)}</button></form>` : ''}</div>`,
        )
        .join('') +
      actionForm(
        'account-form',
        'Create authorized administrator',
        input('email', 'Administrator email', '', 'email') +
          select('role', 'Role', ['inventory', 'orders', 'payments', 'super']) +
          input(
            'password',
            'Administrator-chosen password (12+ characters)',
            '',
            'password',
          ),
      ),
  );
  bind('account-form', 'admin/accounts', (d) => d, accounts, true);
  document.querySelectorAll<HTMLFormElement>('[data-role-id]').forEach(
    (form) =>
      (form.onsubmit = async (e) => {
        e.preventDefault();
        if (
          !confirm(
            'Change this administrator’s role and revoke their sessions?',
          )
        )
          return;
        try {
          await api('admin/accounts/role', {
            id: form.dataset.roleId,
            role: new FormData(form).get('role'),
          });
          await accounts();
          note('Role updated; previous sessions revoked.');
        } catch (error) {
          note((error as Error).message);
        }
      }),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-disable]').forEach(
    (btn) =>
      (btn.onclick = async () => {
        if (!confirm('Disable this administrator and revoke all sessions?'))
          return;
        try {
          await api('admin/accounts/disable', { id: btn.dataset.disable });
          await accounts();
        } catch (e) {
          note((e as Error).message);
        }
      }),
  );
}
const views: Record<string, () => Promise<void>> = {
  dashboard,
  products,
  orders,
  payments,
  settings,
  accounts,
};
const login = document.querySelector<HTMLFormElement>('#admin-login')!;
login.onsubmit = async (e) => {
  e.preventDefault();
  try {
    user = await api('auth/login', formData(login));
    await dashboard();
    note('Signed in.');
  } catch (error) {
    note((error as Error).message);
  }
};
const recovery = document.querySelector<HTMLFormElement>('#admin-recovery')!;
recovery.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api('auth/reset', formData(recovery));
    note(d.message);
    recovery.reset();
  } catch (error) {
    note((error as Error).message);
  }
};
api('auth/me')
  .then((a) => {
    user = a;
    return dashboard();
  })
  .catch(() => {});
