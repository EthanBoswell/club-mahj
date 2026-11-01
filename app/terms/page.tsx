import LegalDoc from "@/components/LegalDoc";

export const metadata = { title: "Terms | Club Mahj" };

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Club Mahj terms"
      title="Terms for membership and events."
      intro="These terms explain the member experience, event access, payment handling, and basic community expectations for Club Mahj."
      sections={[
        {
          heading: "Membership",
          body: [
            "Club Mahj membership gives you access to the private member app, member pricing shown on each listed event, easy reservations, and a member profile used to help manage your event experience.",
            "Membership does not guarantee a seat at every event. Event space, dates, locations, and availability can change.",
          ],
        },
        {
          heading: "Payments",
          body: [
            "Membership is currently listed at $50/month. Event cards show the public price and any member discount before a reservation or payment.",
            "Helcim handles secure card collection, recurring membership billing, and payment processing. Club Mahj stores member records, payment status, receipt metadata, and payment reference IDs.",
          ],
        },
        {
          heading: "Events and Conduct",
          body: [
            "Club Mahj is for social mahjong, live events, lessons, and community nights. Members are expected to treat other players, hosts, staff, and venues with respect.",
            "Club Mahj may refuse, cancel, or remove access when conduct harms the room, the event, or another member's experience.",
          ],
        },
        {
          heading: "No Wagering",
          body: [
            "Club Mahj membership and events are not gambling products. Event fees are for access, hosting, instruction, food and beverage when included, materials, venue costs, or related event services.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "Club Mahj may update these terms as the membership, events, and app grow. Continued use of the membership or app after changes means you accept the updated terms.",
          ],
        },
      ]}
    />
  );
}
