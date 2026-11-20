import { describe, expect, it } from "vitest";
import { MEMBERSHIP_PRODUCT, PRODUCTS, formatPrice, getAnyProduct, getProduct } from "@/lib/payments/catalog";

describe("catalog", () => {
  // These are the prices the client gave us. If one changes, change it on purpose.
  it.each([
    ["mahj-101", 5000],
    ["mahj-102", 5000],
    ["mahj-103", 5000],
    ["mahj-101-103-package", 12500],
    ["private-lesson", 6000],
    ["bootcamp", 10000],
    ["mahj-and-mingle", 7500],
  ])("%s costs %i cents", (id, cents) => {
    expect(getProduct(id)?.priceCents).toBe(cents);
  });

  it("the 101-103 package saves $25 over three separate courses", () => {
    const separate = (getProduct("mahj-101")!.priceCents) * 3;
    expect(separate - getProduct("mahj-101-103-package")!.priceCents).toBe(2500);
  });

  it("has unique ids and whole-cent integer prices", () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const p of PRODUCTS) expect(Number.isInteger(p.priceCents) && p.priceCents > 0).toBe(true);
  });

  it("returns undefined for unknown products", () => {
    expect(getProduct("nope")).toBeUndefined();
  });

  it("formats prices", () => {
    expect(formatPrice(5000)).toBe("$50");
    expect(formatPrice(12550)).toBe("$125.50");
  });

  it("sells the membership at $50 a month, separately from the Academy products", () => {
    expect(MEMBERSHIP_PRODUCT.priceCents).toBe(5000);
    expect(getProduct(MEMBERSHIP_PRODUCT.id)).toBeUndefined();
    expect(PRODUCTS.some((p) => p.id === MEMBERSHIP_PRODUCT.id)).toBe(false);
    expect(getAnyProduct(MEMBERSHIP_PRODUCT.id)).toBe(MEMBERSHIP_PRODUCT);
    expect(getAnyProduct("mahj-101")?.priceCents).toBe(5000);
    expect(getAnyProduct("nope")).toBeUndefined();
  });
});
