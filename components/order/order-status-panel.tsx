"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { PreservedLink } from "@/components/navigation/preserved-link";
import { interpretRedirectStatus } from "@/lib/order-status";
import { trackEvent } from "@/lib/tracking";

export function OrderStatusPanel() {
  const searchParams = useSearchParams();
  const redirectStatus = searchParams.get("redirect_status");
  const view = interpretRedirectStatus(redirectStatus);

  useEffect(() => {
    trackEvent(view === "success" ? "PurchaseSuccess" : "PurchaseFailed");
  }, [view]);

  if (view === "success") {
    return (
      <section className="status-card status-card--success">
        <p className="eyebrow">Order received</p>
        <h1>Your order is being processed</h1>
        <p>Confirmation and shipping updates will arrive by email. Tracking details are sent after dispatch.</p>
        <PreservedLink className="button button--primary" href="/track-order">Track your order</PreservedLink>
      </section>
    );
  }

  if (view === "failure") {
    return (
      <section className="status-card status-card--error">
        <p className="eyebrow">Order not completed</p>
        <h1>We could not complete payment</h1>
        <p>The payment service reported that this attempt failed. You can return to checkout or contact us for help.</p>
        <div className="status-actions">
          <PreservedLink className="button button--primary" href="/checkout">Return to checkout</PreservedLink>
          <PreservedLink className="button button--secondary" href="/contact">Contact support</PreservedLink>
        </div>
      </section>
    );
  }

  return (
    <section className="status-card status-card--unknown">
      <p className="eyebrow">Status unavailable</p>
      <h1>We cannot confirm your order here</h1>
      <p>This page did not receive a confirmed result. Check your email for an update or contact support before trying again.</p>
      <PreservedLink className="button button--primary" href="/contact">Contact support</PreservedLink>
    </section>
  );
}
