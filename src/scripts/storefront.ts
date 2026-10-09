export {};
// API responses are rendered as text or HTML-escaped values, never trusted markup.
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const money = (n: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    currencyDisplay: 'code',
  }).format(n / 100);
const status = document.querySelector<HTMLElement>('#commerce-status');
const message = (s: string) => {
  if (status) status.textContent = s;
};
async function api(
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const r = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
interface CartItem {
  product_id: string;
  quantity: number;
}
function cart(): CartItem[] {
  try {
    const list = JSON.parse(localStorage.getItem('herb-all-cart') || '[]');
    return Array.isArray(list)
      ? list.filter(
          (i) =>
            typeof i.product_id === 'string' &&
            Number.isSafeInteger(i.quantity) &&
            i.quantity > 0,
        )
      : [];
  } catch {
    return [];
  }
}
function save(items: CartItem[]) {
  localStorage.setItem('herb-all-cart', JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
}
function image(p: any) {
  return p.images?.length
    ? `<img src="/api/media/${esc(p.images[0].id)}" alt="${esc(p.images[0].alt)}" width="600" height="600" loading="lazy"/>`
    : '<div class="shop-image-fallback">Product photograph coming soon</div>';
}
function stock(p: any) {
  return p.unavailable
    ? 'Temporarily unavailable'
    : p.available === 0
      ? 'Out of stock'
      : p.available <= p.low_stock
        ? `Only ${p.available} remaining`
        : 'In stock';
}
function product(p: any, detailed = false) {
  const purchasable = !p.unavailable && p.available >= p.min_quantity;
  return `<article class="card shop-card">${image(p)}<div class="card-body"><p class="eyebrow">${esc(p.category)}</p><h2>${esc(p.name)}</h2><p>${esc(p.variant)}</p><p class="shop-price">${money(p.price_cents)} <span>/ ${esc(p.unit)}</span></p><p>${stock(p)}</p><p>${esc(detailed ? p.description : p.short_description)}</p>${
    detailed
      ? `<p>${esc(p.handling)}</p><p>Order ${p.min_quantity}–${p.max_quantity} units. SKU: ${esc(p.sku)}</p><div class="product-gallery">${(
          p.images || []
        )
          .slice(1)
          .map(
            (m: any) =>
              `<img src="/api/media/${esc(m.id)}" alt="${esc(m.alt)}" width="400" height="400" loading="lazy"/>`,
          )
          .join('')}</div>`
      : ''
  }<form data-add="${esc(p.id)}"><label for="qty-${esc(p.id)}">Quantity for ${esc(p.name)}</label><input id="qty-${esc(p.id)}" name="quantity" type="number" min="${p.min_quantity}" max="${Math.min(p.max_quantity, p.available)}" value="${p.min_quantity}" ${purchasable ? '' : 'disabled'}/><button class="button" ${purchasable ? '' : 'disabled'}>Add to cart</button></form>${!detailed ? `<a class="text-link" href="/shop/?product=${encodeURIComponent(p.slug)}">View ${esc(p.name)} details</a>` : '<a class="text-link" href="/shop/">Back to shop</a>'}</div></article>`;
}
async function shop() {
  const filters = document.querySelector<HTMLFormElement>('#shop-filters');
  if (!filters) return;
  const target = document.querySelector('#shop-content')!;
  const params = new URLSearchParams(location.search);
  for (const field of ['q', 'sort'])
    (filters.elements.namedItem(field) as HTMLInputElement).value =
      params.get(field) || (field === 'sort' ? 'name' : '');
  try {
    const categories = await api('categories');
    const select = filters.elements.namedItem('category') as HTMLSelectElement;
    categories.forEach((c: any) => select.add(new Option(c.name, c.name)));
    select.value = params.get('category') || '';
  } catch {}
  const load = async (page = 1) => {
    try {
      message('Loading current prices and stock…');
      const query = new URLSearchParams({
        q: String(new FormData(filters).get('q') || ''),
        category: String(new FormData(filters).get('category') || ''),
        sort: String(new FormData(filters).get('sort') || 'name'),
        page: String(page),
      });
      if (params.get('product')) query.set('slug', params.get('product')!);
      const data = await api('products?' + query);
      let items = data.items;
      if (params.get('product'))
        items = items.filter((p: any) => p.slug === params.get('product'));
      target.innerHTML = items.length
        ? `<div class="${params.get('product') ? 'shop-detail' : 'card-grid'}">${items.map((p: any) => product(p, !!params.get('product'))).join('')}</div>`
        : '<div class="empty-state"><h2>The next growing collection is on its way.</h2><p>No matching published stock is available. <a href="/contact/">Ask Herb-All about plants and availability</a>.</p></div>';
      message('');
      const pagination = document.querySelector('#shop-pagination')!;
      pagination.innerHTML =
        data.total > 24
          ? `<button class="button outline" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${page}</span><button class="button outline" data-page="${page + 1}" ${page * 24 >= data.total ? 'disabled' : ''}>Next</button>`
          : '';
      pagination
        .querySelectorAll<HTMLButtonElement>('[data-page]')
        .forEach((btn) => (btn.onclick = () => load(Number(btn.dataset.page))));
      target.querySelectorAll<HTMLFormElement>('[data-add]').forEach((form) =>
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          message('Checking stock and updating your cart…');
          const buttons = Array.from(
            target.querySelectorAll<HTMLButtonElement>('[data-add] button'),
          ).map((button) => ({ button, disabled: button.disabled }));
          buttons.forEach(({ button }) => (button.disabled = true));
          const quantity = Number(new FormData(form).get('quantity'));
          const list = cart();
          const item = list.find((i) => i.product_id === form.dataset.add);
          if (item) item.quantity += quantity;
          else list.push({ product_id: form.dataset.add!, quantity });
          try {
            await api('quote', { items: list });
            save(list);
            message(
              'Added to your cart. Continue shopping or review your cart.',
            );
          } catch (error) {
            message((error as Error).message);
          } finally {
            buttons.forEach(
              ({ button, disabled }) => (button.disabled = disabled),
            );
          }
        }),
      );
    } catch (e) {
      message((e as Error).message);
      target.innerHTML =
        '<p>Live shopping is unavailable. <a href="/contact/">Contact Herb-All</a> or try again later.</p>';
    }
  };
  filters.onsubmit = (e) => {
    e.preventDefault();
    params.delete('product');
    const query = new URLSearchParams(new FormData(filters) as any);
    history.replaceState(null, '', '/shop/?' + query);
    load();
  };
  await load(Number(params.get('page')) || 1);
}
function summary(q: any) {
  return `<h2>Order summary</h2><ul class="order-lines">${q.items.map((i: any) => `<li><strong>${esc(i.name)}</strong> · ${i.quantity} × ${money(i.unit_price_cents)} <span>${money(i.unit_price_cents * i.quantity)}</span></li>`).join('')}</ul><p>Merchandise subtotal <strong>${money(q.subtotal_cents)}</strong></p><p>50% merchandise deposit <strong>${money(q.deposit_cents)}</strong></p><p>Transport: ${q.transport_cents === 0 ? 'farm collection — no transport charge' : 'awaiting Herb-All quotation (not included)'}.</p>`;
}
async function renderCart() {
  const el = document.querySelector('#cart-content');
  if (!el) return;
  const items = cart();
  if (!items.length) {
    el.innerHTML =
      '<h2>Your cart has room to grow.</h2><p>Browse the shop to add available plants and products.</p>';
    return;
  }
  try {
    const [q, settings] = await Promise.all([
      api('quote', { items }),
      api('public/settings'),
    ]);
    el.innerHTML =
      summary(q) +
      q.items
        .map(
          (i: any) =>
            `<div class="cart-row"><label for="cart-${esc(i.product_id)}">${esc(i.name)} quantity</label><input id="cart-${esc(i.product_id)}" data-quantity="${esc(i.product_id)}" type="number" min="1" max="10000" value="${i.quantity}"/><button class="button outline" data-remove="${esc(i.product_id)}">Remove ${esc(i.name)}</button></div>`,
        )
        .join('');
    (document.querySelector('#checkout-link') as HTMLElement).hidden =
      !settings.checkout_enabled;
    if (!settings.checkout_enabled)
      message('Checkout is not open yet. Contact Herb-All about availability.');
    el.querySelectorAll<HTMLInputElement>('[data-quantity]').forEach(
      (input) =>
        (input.onchange = async () => {
          message('Updating your cart…');
          const controls = Array.from(
            el.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
              'input,button',
            ),
          );
          controls.forEach((control) => (control.disabled = true));
          (document.querySelector('#checkout-link') as HTMLElement).hidden =
            true;
          const list = cart();
          const item = list.find(
            (i) => i.product_id === input.dataset.quantity,
          )!;
          item.quantity = Number(input.value);
          try {
            await api('quote', { items: list });
            save(list);
            await renderCart();
            message('Cart updated.');
          } catch (e) {
            message((e as Error).message);
            input.value = String(
              cart().find((i) => i.product_id === input.dataset.quantity)!
                .quantity,
            );
          } finally {
            controls.forEach((control) => (control.disabled = false));
            (document.querySelector('#checkout-link') as HTMLElement).hidden =
              !settings.checkout_enabled;
          }
        }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(
      (btn) =>
        (btn.onclick = () => {
          save(cart().filter((i) => i.product_id !== btn.dataset.remove));
          location.reload();
        }),
    );
  } catch (e) {
    message((e as Error).message);
    el.innerHTML = items
      .map(
        (i) =>
          `<div class="cart-row"><span>Selected product · ${i.quantity} units</span><button class="button outline" data-remove="${esc(i.product_id)}">Remove unavailable item</button></div>`,
      )
      .join('');
    el.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(
      (btn) =>
        (btn.onclick = () => {
          save(cart().filter((i) => i.product_id !== btn.dataset.remove));
          location.reload();
        }),
    );
  }
}
async function checkout() {
  const form = document.querySelector<HTMLFormElement>('#checkout-form');
  if (!form) return;
  try {
    const [q, s] = await Promise.all([
      api('quote', { items: cart() }),
      api('public/settings'),
    ]);
    document.querySelector('#checkout-summary')!.innerHTML =
      summary(q) +
      `<p>Unpaid reservations are normally held for ${s.reservation_hours} hours; exact expiry is shown on your order. Pending payment evidence is held for staff reconciliation until reviewed.</p>`;
    const method = form.elements.namedItem(
      'delivery_method',
    ) as HTMLSelectElement;
    if (s.collection_enabled)
      method.add(new Option('Farm collection by arrangement', 'collection'));
    method.onchange = () => {
      const fields =
        form.querySelector<HTMLFieldSetElement>('#delivery-fields')!;
      fields.disabled = method.value === 'collection';
      fields.hidden = fields.disabled;
      document.querySelector('#checkout-summary')!.innerHTML =
        summary({ ...q, transport_cents: fields.disabled ? 0 : null }) +
        `<p>Unpaid reservations: ${s.reservation_hours} hours, with pending evidence held for staff review.</p>`;
    };
    if (!s.checkout_enabled) {
      message(
        'Checkout is not open yet. Please contact Herb-All about availability.',
      );
      return;
    }
    (form.querySelector('button') as HTMLButtonElement).disabled = false;
    let pending: any = null;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector('button')!;
      button.disabled = true;
      const payload = {
        ...Object.fromEntries(new FormData(form)),
        items: cart(),
      };
      if (
        !pending ||
        JSON.stringify(payload) !== JSON.stringify(pending.payload)
      )
        pending = { payload, key: crypto.randomUUID().replaceAll('-', '') };
      try {
        const result = await api('orders', pending.payload, {
          'Idempotency-Key': pending.key,
        });
        sessionStorage.setItem(
          'herb-all-order',
          JSON.stringify({
            reference: result.order.reference,
            tracking_token: result.tracking_token,
          }),
        );
        save([]);
        location.href = '/order/';
      } catch (error) {
        message((error as Error).message);
        button.disabled = false;
      }
    };
  } catch (e) {
    message((e as Error).message);
  }
}
function orderView(o: any) {
  return `<div class="order-panel"><h2>Order ${esc(o.reference)}</h2><p class="status-label">${esc(o.status.replaceAll('_', ' '))}</p><p>Reserved until ${esc(new Date(o.reservation_expires_at).toLocaleString())}. Keep the private tracking key displayed in the form above; it is needed on another device.</p><ul class="order-lines">${o.items.map((i: any) => `<li>${esc(i.name)} · ${i.quantity} × ${money(i.unit_price_cents)}</li>`).join('')}</ul><dl class="financials"><dt>Merchandise</dt><dd>${money(o.merchandise_cents)}</dd><dt>50% merchandise deposit</dt><dd>${money(o.deposit_cents)}</dd><dt>Transport</dt><dd>${o.transport_cents === null ? 'Awaiting quotation' : money(o.transport_cents) + ' — ' + esc(o.transport_policy)}</dd><dt>Verified payments (less refunds)</dt><dd>${money(o.paid_cents)}</dd><dt>Deposit and upfront transport still due</dt><dd>${money(o.deposit_outstanding_cents)}</dd><dt>Currently requested</dt><dd>${money(o.current_due_cents)}</dd><dt>Refund / overpayment awaiting reconciliation</dt><dd>${money(o.refund_due_cents)}</dd><dt>Total outstanding</dt><dd>${money(o.outstanding_cents)}${o.transport_cents === null ? ' + transport pending' : ''}</dd></dl><p>Merchandise balance payment: ${esc(o.balance_policy.replaceAll('_', ' '))}. Road distance: ${o.distance_meters === null ? 'not available — administrator review' : (o.distance_meters / 1000).toFixed(1) + ' km estimate; not a transport price'}.</p><ol class="timeline">${o.timeline.map((h: any) => `<li><strong>${esc(h.event)}</strong><br/><small>${esc(new Date(h.created_at).toLocaleString())}</small>${h.data?.notes ? `<p>${esc(h.data.notes)}</p>` : ''}</li>`).join('')}</ol></div>${o.payment_available ? `<section class="order-panel"><h2>Pochi la Biashara payment</h2><p>Payee: <strong>${esc(o.payment_instructions.payee)}</strong></p><p>Pochi number: <strong>${esc(o.payment_instructions.phone)}</strong></p><p>${esc(o.payment_instructions.instructions)}</p><p>Use order reference ${esc(o.reference)} when contacting Herb-All. Confirm the payee shown on M-Pesa before approving payment. Never share your PIN.</p><p>Currently requested: ${money(o.current_due_cents)}. This includes only confirmed applicable charges. Submitted evidence is not proof of receipt.</p><form id="payment-form"><label for="receipt-code">M-Pesa transaction code</label><input id="receipt-code" name="reference" pattern="[A-Za-z0-9]{10}" required maxlength="10"/><label for="receipt-amount">Amount paid (KES)</label><input id="receipt-amount" name="amount" inputmode="decimal" required/><label for="payer-phone">Payer mobile number</label><input id="payer-phone" name="phone" type="tel" required/><label for="paid-at">Date and time of payment</label><input id="paid-at" name="paid_at" type="datetime-local" required/><label for="payment-message">Additional payment details (optional)</label><textarea id="payment-message" name="message" maxlength="1000"></textarea><label for="payment-file">Receipt image (optional; JPEG, PNG or WebP, maximum 2 MB)</label><input id="payment-file" type="file" accept="image/jpeg,image/png,image/webp"/><button class="button">Submit payment evidence</button></form></section>` : `<p class="safety-note">${o.current_due_cents === 0 ? 'No additional payment is currently requested. Check the agreed balance terms and order progress.' : 'Do not pay yet. Herb-All must confirm stock, transport terms and verified payment instructions.'} Contact Herb-All if you have already paid or need to reconcile a refund.</p>`}<section><h2>Payment submissions</h2>${o.payments.length ? o.payments.map((p: any) => `<p>${esc(p.reference)} · ${money(Number(p.reported_cents))} · ${esc(p.state)}${p.reason ? ' — ' + esc(p.reason) : ''}</p>`).join('') : '<p>No payment evidence submitted.</p>'}</section>`;
}
async function tracking() {
  const form = document.querySelector<HTMLFormElement>('#tracking-form');
  if (!form) return;
  const keyInput = form.elements.namedItem(
    'tracking_token',
  ) as HTMLInputElement;
  const reveal =
    document.querySelector<HTMLButtonElement>('#show-tracking-key')!;
  reveal.onclick = () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    reveal.textContent =
      keyInput.type === 'password' ? 'Show private key' : 'Hide private key';
  };
  document.querySelector<HTMLButtonElement>('#copy-tracking-key')!.onclick =
    async () => {
      try {
        await navigator.clipboard.writeText(keyInput.value);
        message('Private tracking key copied. Store it safely.');
      } catch {
        keyInput.type = 'text';
        keyInput.select();
        message('Select and copy the private tracking key.');
      }
    };
  try {
    const remembered = JSON.parse(
      sessionStorage.getItem('herb-all-order') || 'null',
    );
    if (remembered) {
      (form.elements.namedItem('reference') as HTMLInputElement).value =
        remembered.reference;
      (form.elements.namedItem('tracking_token') as HTMLInputElement).value =
        remembered.tracking_token;
    }
  } catch {}
  const load = async () => {
    try {
      const credentials = Object.fromEntries(new FormData(form));
      const o = await api('track', credentials);
      document.querySelector('#order-content')!.innerHTML = orderView(o);
      message(
        'Order loaded. Save your order reference and private tracking key.',
      );
      const payment = document.querySelector<HTMLFormElement>('#payment-form');
      if (payment)
        payment.onsubmit = async (e) => {
          e.preventDefault();
          const button = payment.querySelector('button')!;
          button.disabled = true;
          try {
            const data = Object.fromEntries(new FormData(payment));
            const result = await api('payment', {
              ...data,
              paid_at: new Date(String(data.paid_at)).toISOString(),
              order_reference: credentials.reference,
              tracking_token: credentials.tracking_token,
            });
            const file = (
              payment.querySelector('#payment-file') as HTMLInputElement
            ).files?.[0];
            if (file) {
              if (file.size > 2097152)
                throw new Error(
                  'Payment evidence saved, but receipt exceeds 2 MB. Contact Herb-All to provide it.',
                );
              const bytes = new Uint8Array(await file.arrayBuffer());
              let binary = '';
              bytes.forEach((v) => (binary += String.fromCharCode(v)));
              await api('payment/attachment', {
                order_reference: credentials.reference,
                tracking_token: credentials.tracking_token,
                payment_id: result.submitted_payment_id,
                data: btoa(binary),
              });
            }
            await load();
            message('Payment submitted — awaiting Herb-All verification.');
          } catch (error) {
            message((error as Error).message);
            button.disabled = false;
          }
        };
    } catch (e) {
      document.querySelector('#order-content')!.innerHTML = '';
      message((e as Error).message);
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    load();
  };
  if ((form.elements.namedItem('reference') as HTMLInputElement).value)
    await load();
}
shop();
renderCart();
checkout();
tracking();
