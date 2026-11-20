import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeStore } from "./helpers";

const store = fakeStore();
const createCheckoutSession = vi.fn();
let configured = true;
let user: { id: string; email: string } | null = null;

vi.mock("@/lib/payments/orders", () => ({ getOrderStore: () => store }));
vi.mock("@/lib/data", () => ({ getUser: async () => user }));
vi.mock("@/lib/payments/clover", async () => ({
  ...(await vi.importActual<typeof import("@/lib/payments/clover")>("@/lib/payments/clover")),
  cloverConfig: () => (configured ? { token: "t", merchantId: "m", baseUrl: "b" } : null),
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));

import { POST } from "@/app/api/checkout/route";

const post = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return POST(new Request("https://club.example/api/checkout", { method: "POST", body }));
};

beforeEach(() => {
  store.orders.length = 0;
  createCheckoutSession.mockReset().mockResolvedValue({ href: "https://pay.example/s1", checkoutSessionId: "s1" });
  configured = true;
  user = null;
  vi.stubEnv("SITE_URL", "https://club.example");
});

describe("POST /api/checkout", () => {
  it("creates a Clover session, records a pending order and redirects to Clover", async () => {
    const res = await post({ productId: "mahj-101" });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://pay.example/s1");
    expect(store.orders).toEqual([
      expect.objectContaining({ productId: "mahj-101", quantity: 1, amountCents: 5000, cloverSessionId: "s1", status: "pending" }),
    ]);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      lineItems: [expect.objectContaining({ name: "Mahjong 101", price: 5000, unitQty: 1 })],
      successUrl: "https://club.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      failureUrl: "https://club.example/checkout/failed",
    }));
  });

  it("multiplies the price by the quantity", async () => {
    await post({ productId: "bootcamp", quantity: "3" });
    expect(store.orders[0]).toMatchObject({ quantity: 3, amountCents: 30000 });
  });

  it("ignores any price the browser sends", async () => {
    await post({ productId: "mahj-101", price: "1", amountCents: "1" });
    expect(store.orders[0].amountCents).toBe(5000);
    expect(createCheckoutSession.mock.calls[0][0].lineItems[0].price).toBe(5000);
  });

  it("attaches the signed-in member to the order", async () => {
    user = { id: "user-1", email: "m@club.example" };
    await post({ productId: "mahj-102" });
    expect(store.orders[0]).toMatchObject({ userId: "user-1", email: "m@club.example" });
    expect(createCheckoutSession.mock.calls[0][0].email).toBe("m@club.example");
  });

  it("rejects an unknown product", async () => {
    const res = await post({ productId: "free-money" });
    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(store.orders).toHaveLength(0);
  });

  it.each(["0", "-1", "1.5", "abc", "11"])("rejects quantity %s", async (quantity) => {
    const res = await post({ productId: "mahj-101", quantity });
    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("sends the member back to the Academy when payments are not configured", async () => {
    configured = false;
    const res = await post({ productId: "mahj-101" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://club.example/academy?checkout=unavailable");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("shows a friendly message, and records nothing, when Clover rejects or is down", async () => {
    const { CloverError } = await import("@/lib/payments/clover");
    createCheckoutSession.mockRejectedValue(new CloverError("down", 503));
    const res = await post({ productId: "mahj-101" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://club.example/academy?checkout=error");
    expect(store.orders).toHaveLength(0);
  });

  it("cannot be used to buy the membership, which has its own route", async () => {
    const res = await post({ productId: "membership-month" });
    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("does not record an order if something other than Clover fails", async () => {
    createCheckoutSession.mockRejectedValue(new Error("clover down"));
    await expect(post({ productId: "mahj-101" })).rejects.toThrow("clover down");
    expect(store.orders).toHaveLength(0);
  });
});
