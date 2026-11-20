import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloverError, cloverConfig, createCheckoutSession } from "@/lib/payments/clover";

const input = {
  lineItems: [{ name: "Mahjong 101", note: "90-minute course", price: 5000, unitQty: 2 }],
  successUrl: "https://club.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  failureUrl: "https://club.example/checkout/failed",
};

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubEnv("CLOVER_API_TOKEN", "test-token");
  vi.stubEnv("CLOVER_MERCHANT_ID", "MERCHANT123");
  vi.stubEnv("CLOVER_API_BASE", "");
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cloverConfig", () => {
  it("is null until both the token and merchant id are set", () => {
    vi.stubEnv("CLOVER_MERCHANT_ID", "");
    expect(cloverConfig()).toBeNull();
  });

  it("defaults to the sandbox host and strips a trailing slash from an override", () => {
    vi.stubEnv("CLOVER_API_BASE", undefined as unknown as string);
    expect(cloverConfig()?.baseUrl).toBe("https://apisandbox.dev.clover.com");
    vi.stubEnv("CLOVER_API_BASE", "https://example.test/");
    expect(cloverConfig()?.baseUrl).toBe("https://example.test");
  });
});

describe("createCheckoutSession", () => {
  it("sends the documented request and returns the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({ href: "https://pay.example/abc", checkoutSessionId: "abc", createdTime: 1, expirationTime: 2 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CLOVER_API_BASE", undefined as unknown as string);

    const session = await createCheckoutSession({ ...input, email: "a@b.co" });

    expect(session).toEqual({ href: "https://pay.example/abc", checkoutSessionId: "abc", expirationTime: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://apisandbox.dev.clover.com/invoicingcheckoutservice/v1/checkouts");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-token");
    expect(init.headers["X-Clover-Merchant-Id"]).toBe("MERCHANT123");
    expect(JSON.parse(init.body)).toEqual({
      customer: { email: "a@b.co" },
      shoppingCart: { lineItems: [{ name: "Mahjong 101", note: "90-minute course", price: 5000, unitQty: 2 }] },
      redirectUrls: { success: input.successUrl, failure: input.failureUrl },
    });
  });

  it("sends an empty customer object when there is no email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ href: "h", checkoutSessionId: "s" }));
    vi.stubGlobal("fetch", fetchMock);
    await createCheckoutSession(input);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).customer).toEqual({});
  });

  it("throws a CloverError with the status when Clover rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ message: "nope" }, 401)));
    await expect(createCheckoutSession(input)).rejects.toMatchObject({ name: "CloverError", status: 401 });
  });

  it("throws when the response has no checkout url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ checkoutSessionId: "abc" })));
    await expect(createCheckoutSession(input)).rejects.toBeInstanceOf(CloverError);
  });

  it("throws when Clover is not configured, without calling out", async () => {
    vi.stubEnv("CLOVER_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createCheckoutSession(input)).rejects.toBeInstanceOf(CloverError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
