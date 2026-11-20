// Single source of truth for what the Academy sells. Prices are in cents and are
// always looked up here on the server, never taken from the browser.
export type Product = {
  id: string;
  name: string;
  note: string;
  priceCents: number;
};

export const PRODUCTS: Product[] = [
  { id: "mahj-101", name: "Mahjong 101", note: "90-minute course", priceCents: 5000 },
  { id: "mahj-102", name: "Mahjong 102", note: "90-minute course", priceCents: 5000 },
  { id: "mahj-103", name: "Mahjong 103", note: "90-minute course", priceCents: 5000 },
  { id: "mahj-101-103-package", name: "Mahj 101-103 package", note: "Three 90-minute courses", priceCents: 12500 },
  { id: "private-lesson", name: "Private individual lesson", note: "One-on-one, per course", priceCents: 6000 },
  { id: "bootcamp", name: "Mahjong bootcamp", note: "4 hours", priceCents: 10000 },
  { id: "mahj-and-mingle", name: "Mahjong & Mingle", note: "3-hour girls night in (can be daytime)", priceCents: 7500 },
];

export const MAX_QUANTITY = 10;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatPrice(cents: number): string {
  return Number.isInteger(cents / 100) ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** The monthly membership. Sold through its own route, never through the Academy checkout. */
export const MEMBERSHIP_PRODUCT: Product = {
  id: "membership-month",
  name: "Club Mahj monthly membership",
  note: "One month of membership",
  priceCents: 5000,
};

/** Looks up anything we sell, including the membership. */
export function getAnyProduct(id: string): Product | undefined {
  return getProduct(id) ?? (id === MEMBERSHIP_PRODUCT.id ? MEMBERSHIP_PRODUCT : undefined);
}
