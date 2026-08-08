import { SiteLogo } from "@/components/brand/site-logo";
import { ContactForm } from "@/components/forms/contact-form";
import { HomeLink } from "@/components/layout/home-link";
import { publicEnv } from "@/lib/public-env";

export default function ContactPage() {
  return (
    <main className="subpage-shell support-page">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <section className="support-card">
        <p className="eyebrow">Customer care</p>
        <h1>How can we help?</h1>
        <p>Send us a message below or email {publicEnv.contactEmail}.</p>
        <ContactForm />
      </section>
    </main>
  );
}
