import { highestLineTotalListing, type QuoteResponse } from "@/lib/quote";

export type TrackingEvent =
  | "PageView"
  | "CTAClick"
  | "OfferSelect"
  | "VideoPlay"
  | "StartCheckoutForm"
  | "InitiatePurchase"
  | "PurchaseSuccess"
  | "PurchaseFailed";

export type CheckoutEventPayload = {
  offer_option: string;
  order_total_cents: number;
  currency: string;
  country: string;
  top_listing_id: number;
};

export function checkoutEventPayload(
  offerOption: string,
  country: string,
  quote: QuoteResponse,
): CheckoutEventPayload {
  return {
    offer_option: offerOption,
    order_total_cents: quote.total,
    currency: quote.currency,
    country,
    top_listing_id: highestLineTotalListing(quote),
  };
}

export function trackEvent(name: TrackingEvent, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, payload);
  window.fbq?.("trackCustom", name, payload);
}
