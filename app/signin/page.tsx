import AuthForm from "@/components/AuthForm";
import DemoBanner from "@/components/DemoBanner";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const safe = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  return (
    <>
      <DemoBanner />
      <section className="section">
        <div className="narrow">
          <span className="eyebrow">Welcome back</span>
          <h1><span className="gold-text">Member sign in</span></h1>
          <div className="card" style={{ marginTop: 20 }}><AuthForm mode="signin" returnTo={safe} /></div>
        </div>
      </section>
    </>
  );
}
