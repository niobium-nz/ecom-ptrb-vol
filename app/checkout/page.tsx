import { Suspense } from "react";

import { SiteLogo } from "@/components/brand/site-logo";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { HomeLink } from "@/components/layout/home-link";

export default function CheckoutPage() {
  return (
    <main className="subpage-shell checkout-page">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <header className="subpage-intro">
        <p className="eyebrow">PawTrim Reward Board</p>
        <h1>Complete your order</h1>
        <p>Review your current price, enter your delivery details and pay securely.</p>
      </header>
      <Suspense fallback={<p className="quote-loading">Preparing checkout...</p>}>
        <CheckoutFlow />
      </Suspense>
    </main>
  );
}
