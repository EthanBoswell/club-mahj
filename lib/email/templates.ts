import { MEMBERSHIP_PRODUCT, formatPrice } from "@/lib/payments/catalog";
import type { ReminderTemplate } from "@/lib/payments/membership-service";

const date = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function membershipUrl(): string {
  return `${(process.env.SITE_URL ?? "").replace(/\/$/, "")}/membership`;
}

export const renewalEmail: ReminderTemplate = ({ kind, name, paidThrough, accessUntil }) => {
  const url = membershipUrl();
  const price = formatPrice(MEMBERSHIP_PRODUCT.priceCents);
  const hello = name ? `Hi ${name},` : "Hi,";
  const lines =
    kind === "upcoming"
      ? [
          `Your Club Mahj membership runs through ${date(paidThrough)}.`,
          `To keep your member pricing, renew for ${price} before then. Memberships do not renew automatically, and nothing is charged unless you renew.`,
        ]
      : [
          `Your Club Mahj membership month ended on ${date(paidThrough)}.`,
          `You still have member pricing until ${date(accessUntil)}. Renew for ${price} to keep it.`,
        ];
  const footer = `Renew here: ${url}\n\nYou can turn these reminders off any time on that page.`;
  const subject = kind === "upcoming" ? "Time to renew your Club Mahj membership" : "Your Club Mahj membership has ended";

  const text = [hello, "", ...lines, "", footer].join("\n");
  const html =
    `<p>${escape(hello)}</p>` + lines.map((l) => `<p>${escape(l)}</p>`).join("") +
    `<p><a href="${escape(url)}">Renew your membership</a></p>` +
    `<p style="color:#6b6b6b;font-size:13px">You can turn these reminders off any time on that page.</p>`;
  return { subject, text, html };
};
