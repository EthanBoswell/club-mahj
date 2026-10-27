import AuthForm from "@/components/AuthForm";
import DemoBanner from "@/components/DemoBanner";

export default function Join() {
  return (
    <>
      <DemoBanner />
      <section className="section">
        <div className="narrow">
          <span className="eyebrow">Membership</span>
          <h1><span className="gold-text">Join Club Mahj</span></h1>
          <p className="lede">Free to join. Your profile helps hosts seat you at the right table.</p>
          <div className="card"><AuthForm mode="join" returnTo="/dashboard" /></div>
        </div>
      </section>
    </>
  );
}
