export {};
function update() {
  try {
    const items = JSON.parse(localStorage.getItem('herb-all-cart') || '[]');
    const count = Array.isArray(items)
      ? items.reduce(
          (sum, item) =>
            sum +
            (Number.isSafeInteger(item.quantity) && item.quantity > 0
              ? item.quantity
              : 0),
          0,
        )
      : 0;
    document
      .querySelectorAll('[data-cart-count]')
      .forEach((el) => (el.textContent = String(count)));
    document
      .querySelectorAll('.cart-link')
      .forEach((el) =>
        el.setAttribute(
          'aria-label',
          `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}`,
        ),
      );
  } catch {
    document
      .querySelectorAll('[data-cart-count]')
      .forEach((el) => (el.textContent = '0'));
    document
      .querySelectorAll('.cart-link')
      .forEach((el) => el.setAttribute('aria-label', 'Shopping cart, 0 items'));
  }
}
update();
window.addEventListener('storage', update);
window.addEventListener('cart-updated', update);
