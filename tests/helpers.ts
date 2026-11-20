import { createHmac } from "node:crypto";
import type { NewOrder, Order, OrderStore } from "@/lib/payments/orders";

export const WEBHOOK_SECRET = "test-signing-secret";

/** Builds a Clover-Signature header the same way Clover documents it. */
export function sign(body: string, secret = WEBHOOK_SECRET, t = "1642599079") {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** In-memory stand-in for the Supabase-backed order store. */
export function fakeStore(): OrderStore & { orders: Order[] } {
  const orders: Order[] = [];
  return {
    orders,
    async create(o: NewOrder) {
      const order: Order = { id: `order-${orders.length + 1}`, status: "pending", cloverPaymentId: null, ...o };
      orders.push(order);
      return order;
    },
    async findBySessionId(id) {
      return orders.find((o) => o.cloverSessionId === id) ?? null;
    },
    async markPaid(id, paymentId) {
      const o = orders.find((x) => x.cloverSessionId === id);
      if (o && o.status !== "paid") Object.assign(o, { status: "paid", cloverPaymentId: paymentId });
      return o ?? null;
    },
  };
}
