import { temporaryImage } from '../utils/product-images';
const escape = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function productImageMarkup(
  product: {
    name: string;
    sku: string;
    images?: { id: string; alt: string }[];
  },
  detailed = false,
) {
  const supplied = product.images?.[0];
  const temporary = supplied ? undefined : temporaryImage(product.sku);
  const src = supplied ? `/api/media/${escape(supplied.id)}` : temporary?.image;
  const alt = supplied?.alt || temporary?.imageAlt;
  const placeholder = `<div class="botanical-placeholder" role="img" aria-label="${escape(product.name)} — botanical placeholder" ${src ? 'hidden' : ''}><svg viewBox="0 0 100 100" width="80" height="80" aria-hidden="true"><path d="M50 86V48M50 64C20 64 18 31 18 31S50 31 50 64ZM50 49C78 49 82 17 82 17S50 17 50 49Z" fill="none" stroke="currentColor" stroke-width="3"/></svg><span>${escape(product.name)}</span><small>Product photography coming soon</small></div>`;
  const img = src
    ? `<img data-product-image ${temporary && temporary.width < temporary.height ? 'style="object-fit: contain"' : ''} src="${src}" ${temporary?.variants ? `srcset="${temporary.variants.map((v) => `${v.src} ${v.width}w`).join(', ')}" sizes="(max-width: 760px) calc(100vw - 32px), 600px"` : ''} alt="${escape(alt)}" width="${temporary?.width || 600}" height="${temporary?.height || 600}" loading="${detailed ? 'eager' : 'lazy'}" decoding="async"/>`
    : '';
  const caption = temporary?.isTemporaryImage
    ? `<figcaption>Representative image — Herb-All photography coming soon. <a href="/image-credits/#${temporary.id}">Image credits</a></figcaption>`
    : '';
  return `<figure class="product-visual" data-product-visual><div class="product-visual-media">${placeholder}${img}</div>${caption}</figure>`;
}
export function installProductImageFallbacks(root: ParentNode) {
  root
    .querySelectorAll<HTMLImageElement>('img[data-product-image]')
    .forEach((img) => {
      const fallback = () => {
        img.hidden = true;
        const placeholder = img
          .closest('[data-product-visual]')
          ?.querySelector<HTMLElement>('.botanical-placeholder');
        if (placeholder) placeholder.hidden = false;
      };
      img.addEventListener('error', fallback, { once: true });
      if (img.complete && !img.naturalWidth) fallback();
    });
}
