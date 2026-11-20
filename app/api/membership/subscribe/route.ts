import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { subscribeMember } from "@/lib/payments/membership-service";
import { membershipDeps } from "@/lib/payments/membership-deps";

const STATUS = { consent_required: 400, not_configured: 503, already_member: 409, payment_failed: 402, payment_error: 502 } as const;

// Receives the single-use card token from Clover's iframe (the card number itself never reaches
// this server), charges the first month, and sets up the monthly subscription.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { cloverToken?: unknown; consent?: unknown } | null;
  const token = typeof body?.cloverToken === "string" ? body.cloverToken : "";
  if (!token.startsWith("clv_")) return NextResponse.json({ error: "Missing card token." }, { status: 400 });

  const deps = membershipDeps();
  if (!deps) return NextResponse.json({ error: "Membership billing is not set up yet." }, { status: 503 });

  const clientIp = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const result = await subscribeMember(deps, {
    userId: user.id, email: user.email, name: user.profile?.display_name, token, clientIp, consent: body?.consent === true,
  });

  if (!result.ok) return NextResponse.json({ error: result.message, code: result.code }, { status: STATUS[result.code] });
  return NextResponse.json({ ok: true, renewalsSetUp: result.renewalsSetUp });
}
