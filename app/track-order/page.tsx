import { SiteLogo } from "@/components/brand/site-logo";
import { TrackOrderForm } from "@/components/forms/track-order-form";
import { HomeLink } from "@/components/layout/home-link";

export default function TrackOrderPage() {
  return (
    <main className="subpage-shell support-page">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <section className="support-card">
        <p className="eyebrow">Tracked delivery</p>
        <h1>Track your order</h1>
        <p>Use the email from your order with either your order number or first name.</p>
        <TrackOrderForm />
      </section>
    </main>
  );
}
