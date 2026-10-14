import inventory from '../config/temporary-product-images.json';
export type ProductImage = {
  image: string;
  imageAlt: string;
  width: number;
  height: number;
  variants: { src: string; width: number }[];
  imageCredit: string;
  imageSourceUrl: string;
  imageLicense: string;
  licenseUrl: string;
  isTemporaryImage: boolean;
  label: string;
};
export function temporaryImage(
  key: string,
): (ProductImage & { id: string }) | undefined {
  const mappings = inventory.mappings as Record<string, string>;
  const id = mappings[key];
  const image = (inventory.images as Record<string, ProductImage>)[id];
  return image ? { ...image, id } : undefined;
}
