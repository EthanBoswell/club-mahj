import LegalDoc from "@/components/LegalDoc";

export const metadata = { title: "Privacy | Club Mahj" };

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Club Mahj privacy"
      title="How member information is used."
      intro="Club Mahj collects only the information needed to run membership, events, payments, support, and owner-only business insights."
      sections={[
        {
          heading: "Information We Collect",
          body: [
            "Signup can collect your name, email, phone, address, city, state, ZIP, preferred area, playing experience, availability, event goals, and short profile notes.",
            "The app can also collect event registrations, receipt references, membership status, sign-in activity, and broad app analytics such as page views, device type, and general city or region trends.",
          ],
        },
        {
          heading: "Payments",
          body: [
            "Helcim handles card details and payment processing. Club Mahj does not store full card numbers in the app.",
            "Club Mahj may store payment status, masked payment labels, Helcim reference IDs, receipt metadata, and membership billing status so your account and event records stay connected.",
          ],
        },
        {
          heading: "How We Use Information",
          body: [
            "Club Mahj uses member information to create your account, confirm membership, manage event registrations, send event-related updates, answer support questions, and improve the app experience.",
            "Admin analytics are for owner and staff review only. Members should see the public app, their own profile, their own registrations, and their own receipts.",
          ],
        },
        {
          heading: "Access and Staff",
          body: [
            "Owner-approved staff may access admin tools needed to support members, update events, review registrations, and manage the business.",
            "Admin access is separate from paid membership, so staff can help run Club Mahj without needing to be a paying member.",
          ],
        },
        {
          heading: "Location",
          body: [
            "Club Mahj may use broad location trends, such as city or region, to understand interest and plan events. The app is not designed to publish private location detail to members.",
          ],
        },
      ]}
    />
  );
}
