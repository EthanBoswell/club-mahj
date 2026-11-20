import { beforeEach, describe, expect, it, vi } from "vitest";
import { WEBHOOK_SECRET, fakeStore, sign } from "./helpers";

const store = fakeStore();
vi.mock("@/lib/payments/orders", () => ({ getOrderStore: () => store }));

import { POST } from "@/app/api/clover/webhook/route";

const event = (over: Record<string, unknown> = {}) => ({ type: "PAYMENT", status: "APPROVED", id: "pay-1", merchantId: "m", data: "sess-1", ...over });

const send = (payload: unknown, header?: string | null) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers: Record<string, string> = {};
  const sig = header === undefined ? sign(body) : header;
  if (sig) headers["clover-signature"] = sig;
  return POST(new Request("https://club.example/api/clover/webhook", { method: "POST", body, headers }));
};

beforeEach(() => {
  store.orders.length = 0;
  store.orders.push({
    id: "o1", productId: "mahj-101", quantity: 1, amountCents: 5000, status: "pending",
    cloverSessionId: "sess-1", cloverPaymentId: null, email: null, userId: null,
  });
  vi.stubEnv("CLOVER_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

describe("POST /api/clover/webhook", () => {
  it("marks the order paid on an approved payment", async () => {
    const res = await send(event());
    expect(res.status).toBe(200);
    expect(store.orders[0]).toMatchObject({ status: "paid", cloverPaymentId: "pay-1" });
  });

  it("is idempotent when Clover delivers the same event twice", async () => {
    await send(event());
    const res = await send(event({ id: "pay-2" }));
    expect(res.status).toBe(200);
    expect(store.orders[0]).toMatchObject({ status: "paid", cloverPaymentId: "pay-1" });
  });

  it("rejects a bad signature and leaves the order alone", async () => {
    const res = await send(event(), "t=1,v1=deadbeef");
    expect(res.status).toBe(401);
    expect(store.orders[0].status).toBe("pending");
  });

  it("rejects a request with no signature header", async () => {
    const res = await send(event(), null);
    expect(res.status).toBe(401);
    expect(store.orders[0].status).toBe("pending");
  });

  it("rejects everything when the signing secret is not configured", async () => {
    vi.stubEnv("CLOVER_WEBHOOK_SECRET", "");
    const res = await send(event());
    expect(res.status).toBe(401);
    expect(store.orders[0].status).toBe("pending");
  });

  it("does not mark the order paid for a declined payment", async () => {
    const res = await send(event({ status: "DECLINED" }));
    expect(res.status).toBe(200);
    expect(store.orders[0].status).toBe("pending");
  });

  it("ignores events that are not payments", async () => {
    const res = await send(event({ type: "REFUND" }));
    expect(res.status).toBe(200);
    expect(store.orders[0].status).toBe("pending");
  });

  it("acknowledges a payment for a session we have no order for", async () => {
    const res = await send(event({ data: "unknown-session" }));
    expect(res.status).toBe(200);
    expect(store.orders[0].status).toBe("pending");
  });

  it("returns 400 for a validly signed body that is not JSON", async () => {
    const res = await send("not json");
    expect(res.status).toBe(400);
  });
});
