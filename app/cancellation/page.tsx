import LegalDoc from "@/components/LegalDoc";

export const metadata = { title: "Cancellation and refunds | Club Mahj" };

export default function CancellationPage() {
  return (
    <LegalDoc
      eyebrow="Cancellation and refunds"
      title="Membership and event payment policies."
      intro="This page explains how monthly membership cancellation and event-payment questions should work for Club Mahj members."
      sections={[
        {
          heading: "Monthly Membership",
          body: [
            "Club Mahj membership is currently $50/month and renews automatically. A member can cancel anytime before the next renewal; the current prepaid month stays active and the next monthly bill will not run.",
            "Member event pricing stays available during the active paid membership period. That pricing may end when the membership period ends.",
          ],
        },
        {
          heading: "Event Payments",
          body: [
            "Each event card shows its public price and member price. Some events may be fully included; others may have a member discount or the same public price. The price shown before checkout is the price charged.",
            "Guest event refunds or credits can depend on the event timing, venue commitment, and whether the seat can be reopened.",
          ],
        },
        {
          heading: "Payment Method",
          body: [
            "Helcim manages the secure payment method and payment processing. Club Mahj stores safe references so membership, events, and receipts stay connected to your account.",
          ],
        },
        {
          heading: "Questions",
          body: [
            "For a cancellation, guest event-payment, or member reservation question, use the contact method listed in your Club Mahj member communication or the event details. Include the member name, email used at signup, and the event name if the question is about an event.",
          ],
        },
      ]}
    />
  );
}
