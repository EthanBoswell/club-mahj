import { describe, expect, it } from "vitest";
import { parsePaymentEvent, verifyCloverSignature } from "@/lib/payments/webhook";
import { WEBHOOK_SECRET, sign } from "./helpers";

const body = JSON.stringify({ type: "PAYMENT", status: "APPROVED", id: "pay-1", data: "sess-1" });

describe("verifyCloverSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyCloverSignature(body, sign(body), WEBHOOK_SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyCloverSignature(body.replace("APPROVED", "DECLINED"), sign(body), WEBHOOK_SECRET)).toBe(false);
  });

  it("rejects a body signed with a different secret", () => {
    expect(verifyCloverSignature(body, sign(body, "someone-elses-secret"), WEBHOOK_SECRET)).toBe(false);
  });

  it("rejects a signature made for a different timestamp", () => {
    const header = sign(body, WEBHOOK_SECRET, "1642599079").replace("t=1642599079", "t=1642599080");
    expect(verifyCloverSignature(body, header, WEBHOOK_SECRET)).toBe(false);
  });

  it.each([null, "", "garbage", "t=123", "v1=abc", "t=123,v1="])("rejects a missing or malformed header: %s", (header) => {
    expect(verifyCloverSignature(body, header, WEBHOOK_SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(verifyCloverSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyCloverSignature(body, sign(body, ""), "")).toBe(false);
  });
});

describe("parsePaymentEvent", () => {
  it("reads lower-case keys", () => {
    expect(parsePaymentEvent({ type: "PAYMENT", status: "APPROVED", id: "p", data: "s" })).toEqual({
      type: "PAYMENT", status: "APPROVED", paymentId: "p", sessionId: "s",
    });
  });

  it("reads capitalised keys and normalises case", () => {
    expect(parsePaymentEvent({ Type: "payment", Status: "declined", Id: "p", Data: "s" })).toMatchObject({
      type: "PAYMENT", status: "DECLINED", sessionId: "s",
    });
  });

  it.each([null, "x", 5, [], {}, { type: "PAYMENT" }, { data: "s" }])("returns null for unusable input: %j", (raw) => {
    expect(parsePaymentEvent(raw)).toBeNull();
  });
});
