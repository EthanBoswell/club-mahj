import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCharge, createCustomer, createSubscription, getSubscription, setSubscriptionActive } from "@/lib/payments/recurring";

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("CLOVER_API_TOKEN", "test-token");
  vi.stubEnv("CLOVER_MERCHANT_ID", "MERCHANT123");
  vi.stubEnv("CLOVER_API_BASE", "https://api.example");
  vi.stubEnv("CLOVER_SCL_BASE", "https://scl.example/");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init, body: init.body ? JSON.parse(init.body) : undefined };
};

describe("Clover recurring calls", () => {
  it("saves a card on file on the customers host", async () => {
    fetchMock.mockResolvedValue(ok({ id: "CUST1" }));
    expect(await createCustomer({ email: "a@b.co", name: "Ann", source: "clv_abc" })).toEqual({ id: "CUST1" });
    const c = lastCall();
    expect(c.url).toBe("https://scl.example/v1/customers");
    expect(c.init.method).toBe("POST");
    expect(c.body).toEqual({ email: "a@b.co", firstName: "Ann", source: "clv_abc" });
    expect(c.init.headers.authorization).toBe("Bearer test-token");
    expect(c.init.headers["X-Clover-Merchant-Id"]).toBe("MERCHANT123");
  });

  it("charges the customer in cents with an idempotency key and the client ip", async () => {
    fetchMock.mockResolvedValue(ok({ id: "CH1", paid: true, status: "succeeded" }));
    expect(await createCharge({ amountCents: 5000, customerId: "CUST1", idempotencyKey: "key-1", clientIp: "1.2.3.4" })).toEqual({ id: "CH1", paid: true });
    const c = lastCall();
    expect(c.url).toBe("https://scl.example/v1/charges");
    expect(c.body).toEqual({ amount: 5000, currency: "usd", source: "CUST1" });
    expect(c.init.headers["idempotency-key"]).toBe("key-1");
    expect(c.init.headers["x-forwarded-for"]).toBe("1.2.3.4");
  });

  it("only counts a charge as paid when it succeeded", async () => {
    fetchMock.mockResolvedValue(ok({ id: "CH2", paid: false, status: "failed" }));
    expect((await createCharge({ amountCents: 5000, customerId: "C", idempotencyKey: "k", clientIp: "" })).paid).toBe(false);
    fetchMock.mockResolvedValue(ok({ id: "CH3", paid: true, status: "pending" }));
    expect((await createCharge({ amountCents: 5000, customerId: "C", idempotencyKey: "k", clientIp: "" })).paid).toBe(false);
  });

  it("creates a subscription under the plan, charged automatically", async () => {
    fetchMock.mockResolvedValue(ok({ id: "SUB1" }));
    expect(await createSubscription({ planId: "PLAN1", customerId: "CUST1", startDate: "2026-04-10T12:00:00.000Z" })).toEqual({ id: "SUB1" });
    const c = lastCall();
    expect(c.url).toBe("https://api.example/recurring/v1/plans/PLAN1/subscriptions");
    expect(c.body).toEqual({ collectionMethod: "CHARGE_AUTOMATICALLY", customerId: "CUST1", startDate: "2026-04-10T12:00:00.000Z" });
    expect(c.init.headers["User-Agent"]).toBe("club-mahj/1.0");
  });

  it("deactivates and reads a subscription", async () => {
    fetchMock.mockResolvedValue(ok({ id: "SUB1", active: false }));
    await setSubscriptionActive("SUB1", false);
    expect(lastCall()).toMatchObject({ url: "https://api.example/recurring/v1/subscriptions/SUB1", body: { active: false } });
    expect(lastCall().init.method).toBe("PUT");

    fetchMock.mockResolvedValue(ok({ id: "SUB1", active: true }));
    expect(await getSubscription("SUB1")).toEqual({ active: true });
    expect(lastCall().init.method).toBe("GET");
  });

  it("throws a CloverError carrying the status, without leaking ids into the message", async () => {
    fetchMock.mockResolvedValue(ok({}, 402));
    await expect(createCharge({ amountCents: 5000, customerId: "CUST1", idempotencyKey: "k", clientIp: "" }))
      .rejects.toMatchObject({ name: "CloverError", status: 402 });
  });

  it("fails without calling Clover when it is not configured", async () => {
    vi.stubEnv("CLOVER_API_TOKEN", "");
    await expect(getSubscription("SUB1")).rejects.toMatchObject({ name: "CloverError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
