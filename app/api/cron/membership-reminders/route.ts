import { NextResponse } from "next/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { renewalEmail } from "@/lib/email/templates";
import { getMembershipStore } from "@/lib/payments/memberships";
import { runReminders } from "@/lib/payments/membership-service";

// Runs once a day (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>" with its
// scheduled calls. With no secret configured, every request is refused.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getMembershipStore();
  if (!store || !emailConfigured()) return NextResponse.json({ error: "Email or members are not configured" }, { status: 503 });

  const summary = await runReminders({ store, send: sendEmail, template: renewalEmail });
  return NextResponse.json(summary);
}
