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
  } catch {
    document
      .querySelectorAll('[data-cart-count]')
      .forEach((el) => (el.textContent = '0'));
  }
}
update();
window.addEventListener('storage', update);
window.addEventListener('cart-updated', update);
