import { createClient } from "@supabase/supabase-js";

export type OrderStatus = "pending" | "paid";

export type Order = {
  id: string;
  productId: string;
  quantity: number;
  amountCents: number;
  status: OrderStatus;
  cloverSessionId: string;
  cloverPaymentId: string | null;
  email: string | null;
  userId: string | null;
};

export type NewOrder = Pick<Order, "productId" | "quantity" | "amountCents" | "cloverSessionId" | "email" | "userId">;

export interface OrderStore {
  create(order: NewOrder): Promise<Order>;
  findBySessionId(sessionId: string): Promise<Order | null>;
  /** Marks an order paid. Safe to call twice: a second call returns the already-paid order. */
  markPaid(sessionId: string, paymentId: string): Promise<Order | null>;
}

type Row = {
  id: string; product_id: string; quantity: number; amount_cents: number; status: OrderStatus;
  clover_session_id: string; clover_payment_id: string | null; email: string | null; user_id: string | null;
};

const toOrder = (r: Row): Order => ({
  id: r.id, productId: r.product_id, quantity: r.quantity, amountCents: r.amount_cents, status: r.status,
  cloverSessionId: r.clover_session_id, cloverPaymentId: r.clover_payment_id, email: r.email, userId: r.user_id,
});

// Uses the service-role key, which bypasses row-level security. Server-only: never import
// this from a client component and never prefix the key with NEXT_PUBLIC_.
export function getOrderStore(): OrderStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const store: OrderStore = {
    async create(o) {
      const { data, error } = await db.from("orders").insert({
        product_id: o.productId, quantity: o.quantity, amount_cents: o.amountCents,
        clover_session_id: o.cloverSessionId, email: o.email, user_id: o.userId,
      }).select().single();
      if (error) throw new Error(`orders insert failed: ${error.message}`);
      return toOrder(data as Row);
    },
    async findBySessionId(sessionId) {
      const { data, error } = await db.from("orders").select().eq("clover_session_id", sessionId).maybeSingle();
      if (error) throw new Error(`orders lookup failed: ${error.message}`);
      return data ? toOrder(data as Row) : null;
    },
    async markPaid(sessionId, paymentId) {
      const { error } = await db.from("orders")
        .update({ status: "paid", clover_payment_id: paymentId, paid_at: new Date().toISOString() })
        .eq("clover_session_id", sessionId).neq("status", "paid");
      if (error) throw new Error(`orders update failed: ${error.message}`);
      return store.findBySessionId(sessionId);
    },
  };
  return store;
}
