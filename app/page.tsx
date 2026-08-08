import offers from "@/config/offer-options.json";
import testimonials from "@/config/testimonials.json";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/sections/hero";
import {
  Faq,
  FinalCta,
  HowItWorks,
  ProblemSolution,
  ProofGallery,
  SafetyExpectations,
  TrustStrip,
  UseCases,
} from "@/components/sections/home-sections";
import { Testimonials } from "@/components/sections/testimonials";

const shopperOffers = offers.map((offer) => ({
  source_offer_key: offer.source_offer_key,
  offer_option_key: offer.offer_option_key,
  recommended: offer.recommended,
  name: offer.name,
  default_price: offer.default_price,
}));

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero offers={shopperOffers} />
        <TrustStrip />
        <ProblemSolution />
        <HowItWorks />
        <UseCases />
        <ProofGallery />
        <SafetyExpectations />
        <Testimonials testimonials={testimonials} />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
