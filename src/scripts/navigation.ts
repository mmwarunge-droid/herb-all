export {};
const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
const drawer = document.querySelector<HTMLDialogElement>('#navigation-drawer');
const fallback = document.querySelector<HTMLElement>('.nav-fallback');
if (toggle && drawer && typeof drawer.showModal === 'function') {
  toggle.hidden = false;
  if (fallback) fallback.hidden = true;
  const close = () => drawer.close();
  toggle.addEventListener('click', () => {
    drawer.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('navigation-open');
  });
  drawer.querySelector('[data-close-nav]')?.addEventListener('click', close);
  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex="0"]',
      ),
    ).filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  drawer.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('navigation-open');
    toggle.focus();
  });
  drawer.addEventListener('click', (event) => {
    const box = drawer.getBoundingClientRect();
    if (
      event.target === drawer &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    )
      close();
  });
  drawer
    .querySelectorAll('a')
    .forEach((a) => a.addEventListener('click', close));
  const desktop = matchMedia('(min-width: 1180px)');
  desktop.addEventListener('change', () => {
    if (desktop.matches && drawer.open) close();
  });
}
const more = document.querySelector<HTMLDetailsElement>('.nav-more');
if (more) {
  document.addEventListener('click', (event) => {
    if (!more.contains(event.target as Node)) more.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && more.open) {
      more.open = false;
      more.querySelector('summary')?.focus();
    }
  });
}
