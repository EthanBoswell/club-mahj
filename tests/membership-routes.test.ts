import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeStore } from "./helpers";
import { NOW, day, fakeMembershipStore, member } from "./membership-helpers";

let user: { id: string; email: string } | null = null;
let orders = fakeStore();
let members = fakeMembershipStore();
let cloverOn = true;
let emailOn = true;
const createCheckoutSession = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/data", () => ({ getUser: async () => user }));
vi.mock("@/lib/payments/orders", () => ({ getOrderStore: () => orders }));
vi.mock("@/lib/payments/memberships", () => ({ getMembershipStore: () => members }));
vi.mock("@/lib/payments/clover", async () => ({
  ...(await vi.importActual<typeof import("@/lib/payments/clover")>("@/lib/payments/clover")),
  cloverConfig: () => (cloverOn ? { token: "t", merchantId: "m", baseUrl: "b" } : null),
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));
vi.mock("@/lib/email/send", () => ({ emailConfigured: () => emailOn, sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { GET as cron } from "@/app/api/cron/membership-reminders/route";
import { POST as renew } from "@/app/api/membership/renew/route";
import { POST as reminders } from "@/app/api/membership/reminders/route";

beforeEach(() => {
  user = { id: "u1", email: "m@club.example" };
  orders = fakeStore();
  members = fakeMembershipStore();
  cloverOn = true;
  emailOn = true;
  createCheckoutSession.mockReset().mockResolvedValue({ href: "https://pay.example/m1", checkoutSessionId: "m1" });
  sendEmail.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("SITE_URL", "https://club.example");
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

describe("POST /api/membership/renew", () => {
  const post = () => renew(new Request("https://club.example/api/membership/renew", { method: "POST" }));

  it("starts a $50 checkout tied to the signed-in member and sends them to Clover", async () => {
    const res = await post();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://pay.example/m1");
    expect(orders.orders).toEqual([
      expect.objectContaining({ productId: "membership-month", amountCents: 5000, quantity: 1, userId: "u1", cloverSessionId: "m1", status: "pending" }),
    ]);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      lineItems: [expect.objectContaining({ name: "Club Mahj monthly membership", price: 5000, unitQty: 1 })],
      email: "m@club.example",
    }));
  });

  it("sends signed-out visitors to sign in, without creating an order", async () => {
    user = null;
    const res = await post();
    expect(res.headers.get("location")).toBe("https://club.example/signin?returnTo=%2Fmembership");
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(orders.orders).toHaveLength(0);
  });

  it("goes back to the membership page with a message when payments are off", async () => {
    cloverOn = false;
    expect((await post()).headers.get("location")).toBe("https://club.example/membership?checkout=unavailable");
  });

  it("goes back with an error message, and no order, when Clover fails", async () => {
    const { CloverError } = await import("@/lib/payments/clover");
    createCheckoutSession.mockRejectedValue(new CloverError("down", 503));
    const res = await post();
    expect(res.headers.get("location")).toBe("https://club.example/membership?checkout=error");
    expect(orders.orders).toHaveLength(0);
  });
});

describe("POST /api/membership/reminders", () => {
  const post = (fields: Record<string, string>) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return reminders(new Request("https://club.example/api/membership/reminders", { method: "POST", body }));
  };

  it("turns reminders off when the box is unticked and on when it is ticked", async () => {
    members = fakeMembershipStore([member()]);
    expect((await post({})).headers.get("location")).toBe("https://club.example/membership");
    expect(members.rows.get("u1")?.remindersEnabled).toBe(false);
    await post({ enabled: "on" });
    expect(members.rows.get("u1")?.remindersEnabled).toBe(true);
  });

  it("requires sign-in", async () => {
    user = null;
    members = fakeMembershipStore([member()]);
    expect((await post({})).headers.get("location")).toContain("/signin");
    expect(members.rows.get("u1")?.remindersEnabled).toBe(true);
  });
});

describe("GET /api/cron/membership-reminders", () => {
  const get = (auth?: string) =>
    cron(new Request("https://club.example/api/cron/membership-reminders", { headers: auth ? { authorization: auth } : {} }));

  it("emails members who are due and reports counts without exposing addresses", async () => {
    members = fakeMembershipStore([member({ paidThrough: day(2) })]);
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "u1@club.example" }));
  });

  it.each([undefined, "Bearer wrong", "cron-secret", "bearer cron-secret"])("refuses a caller with authorization %s", async (auth) => {
    members = fakeMembershipStore([member({ paidThrough: day(2) })]);
    expect((await get(auth)).status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses everyone when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await get("Bearer ")).status).toBe(401);
    expect((await get("Bearer undefined")).status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 503 when email is not set up, without trying to send", async () => {
    emailOn = false;
    members = fakeMembershipStore([member({ paidThrough: day(2) })]);
    expect((await get("Bearer cron-secret")).status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
