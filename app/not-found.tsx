import { SiteLogo } from "@/components/brand/site-logo";
import { HomeLink } from "@/components/layout/home-link";

export default function NotFound() {
  return (
    <main className="subpage-shell">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <section className="policy-card">
        <p className="eyebrow">Page not found</p>
        <h1>This page wandered off</h1>
        <p>Return to the product page to choose your PawTrim set.</p>
        <HomeLink className="button button--primary" label="Back to home" />
      </section>
    </main>
  );
}
