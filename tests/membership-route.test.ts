import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, deps, fakeClover, fakeMembershipStore, member } from "./membership-helpers";

let user: { id: string; email: string; profile?: { display_name: string } } | null = null;
let store = fakeMembershipStore();
let clover = fakeClover();
let configured = true;

vi.mock("@/lib/data", () => ({ getUser: async () => user }));
vi.mock("@/lib/payments/membership-deps", () => ({ membershipDeps: () => (configured ? deps(store, clover) : null) }));

import { POST as cancel } from "@/app/api/membership/cancel/route";
import { POST as subscribe } from "@/app/api/membership/subscribe/route";

const sub = (body: unknown, headers: Record<string, string> = {}) =>
  subscribe(new Request("https://club.example/api/membership/subscribe", {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers,
  }));

beforeEach(() => {
  user = { id: "u1", email: "m@club.example", profile: { display_name: "Mae" } };
  store = fakeMembershipStore();
  clover = fakeClover();
  configured = true;
  vi.stubEnv("SITE_URL", "https://club.example");
  vi.setSystemTime(NOW);
});

describe("POST /api/membership/subscribe", () => {
  it("subscribes a signed-in member and passes along their details and ip", async () => {
    const res = await sub({ cloverToken: "clv_abc", consent: true }, { "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, renewalsSetUp: true });
    expect(clover.createCustomer).toHaveBeenCalledWith({ email: "m@club.example", name: "Mae", source: "clv_abc" });
    expect(clover.createCharge).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 5000, clientIp: "9.9.9.9" }));
    expect(store.rows.get("u1")?.status).toBe("active");
  });

  it("requires sign-in", async () => {
    user = null;
    expect((await sub({ cloverToken: "clv_abc", consent: true })).status).toBe(401);
    expect(clover.createCharge).not.toHaveBeenCalled();
  });

  it.each([{}, { cloverToken: 5 }, { cloverToken: "4242424242424242" }, { cloverToken: "" }])("rejects a missing or non-token value %j", async (body) => {
    expect((await sub({ ...body, consent: true })).status).toBe(400);
    expect(clover.createCustomer).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    expect((await sub("nope")).status).toBe(400);
  });

  it("requires consent", async () => {
    const res = await sub({ cloverToken: "clv_abc" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("consent_required");
    expect(clover.createCharge).not.toHaveBeenCalled();
  });

  it("returns 402 for a declined card and 409 for someone already a member", async () => {
    clover.createCharge.mockResolvedValue({ id: "", paid: false });
    expect((await sub({ cloverToken: "clv_abc", consent: true })).status).toBe(402);

    store = fakeMembershipStore(member());
    expect((await sub({ cloverToken: "clv_abc", consent: true })).status).toBe(409);
  });

  it("returns 503 when membership billing is not configured", async () => {
    configured = false;
    expect((await sub({ cloverToken: "clv_abc", consent: true })).status).toBe(503);
  });
});

describe("POST /api/membership/cancel", () => {
  const post = () => cancel(new Request("https://club.example/api/membership/cancel", { method: "POST" }));

  it("cancels and redirects back to the membership page", async () => {
    store = fakeMembershipStore(member());
    const res = await post();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://club.example/membership?canceled=1");
    expect(store.rows.get("u1")?.status).toBe("canceled");
  });

  it("redirects to sign-in when signed out", async () => {
    user = null;
    const res = await post();
    expect(res.headers.get("location")).toBe("https://club.example/signin?returnTo=%2Fmembership");
    expect(clover.setSubscriptionActive).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the membership when Clover fails", async () => {
    store = fakeMembershipStore(member());
    clover.setSubscriptionActive.mockRejectedValue(new Error("down"));
    const res = await post();
    expect(res.headers.get("location")).toContain("/membership?error=");
    expect(store.rows.get("u1")?.status).toBe("active");
  });
});
