import { Suspense } from "react";

import { SiteLogo } from "@/components/brand/site-logo";
import { HomeLink } from "@/components/layout/home-link";
import { OrderStatusPanel } from "@/components/order/order-status-panel";

export default function OrderStatusPage() {
  return (
    <main className="subpage-shell support-page">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <Suspense fallback={<p className="quote-loading">Checking the return status...</p>}>
        <OrderStatusPanel />
      </Suspense>
    </main>
  );
}
