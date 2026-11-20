// One-time setup: creates the monthly membership plan in Clover and prints its id.
//   CLOVER_API_TOKEN=... CLOVER_MERCHANT_ID=... node scripts/create-clover-plan.mjs <amount>
// Clover's docs do not say whether plan amounts are in cents or dollars. Run this against the
// sandbox first, check the plan in the Clover dashboard, and make sure it shows $50 per month.
const { CLOVER_API_TOKEN, CLOVER_MERCHANT_ID, CLOVER_API_BASE = "https://apisandbox.dev.clover.com" } = process.env;
const amount = Number(process.argv[2]);
if (!CLOVER_API_TOKEN || !CLOVER_MERCHANT_ID || !Number.isInteger(amount) || amount <= 0) {
  console.error("Usage: CLOVER_API_TOKEN=... CLOVER_MERCHANT_ID=... node scripts/create-clover-plan.mjs <amount>");
  process.exit(1);
}
const res = await fetch(`${CLOVER_API_BASE}/recurring/v1/plans`, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "User-Agent": "club-mahj/1.0",
    authorization: `Bearer ${CLOVER_API_TOKEN}`,
    "X-Clover-Merchant-Id": CLOVER_MERCHANT_ID,
  },
  body: JSON.stringify({ name: "Club Mahj monthly membership", amount, interval: "MONTH", intervalCount: 1 }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Clover returned ${res.status}`, body);
  process.exit(1);
}
console.log(`Created plan ${body.id}. Set CLOVER_MEMBERSHIP_PLAN_ID=${body.id}`);
console.log(JSON.stringify(body, null, 2));
