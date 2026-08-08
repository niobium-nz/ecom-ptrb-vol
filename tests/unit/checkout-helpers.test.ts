import { describe, expect, it, vi } from "vitest";

import { checkoutFieldConfig, normalizePostcode, validPostcode } from "@/lib/checkout-fields";
import { normalizeCoupon, selectCoupon } from "@/lib/coupon";
import { interpretRedirectStatus } from "@/lib/order-status";
import { internalUrl, preservedQuery } from "@/lib/query-params";
import { checkoutEventPayload, trackEvent } from "@/lib/tracking";

describe("checkout helpers", () => {
  it("uses manual, landing, then fallback coupon priority", () => {
    expect(normalizeCoupon("  SAVE ")).toBe("SAVE");
    expect(normalizeCoupon(" ")).toBeNull();
    expect(selectCoupon({ manual: "MANUAL", landing: "LAND", fallback: "FALL" })).toBe("MANUAL");
    expect(selectCoupon({ manual: "", landing: "LAND", fallback: "FALL" })).toBe("LAND");
    expect(selectCoupon({ manual: null, landing: null, fallback: "FALL" })).toBe("FALL");
    expect(selectCoupon({})).toBeNull();
  });

  it("localizes fields and validates every supported country postcode rule", () => {
    expect(checkoutFieldConfig("AU")).toMatchObject({ cityLabel: "Suburb", stateRequired: true });
    expect(checkoutFieldConfig("SG")).toMatchObject({ postcodeRequired: true, stateRequired: false });
    expect(() => checkoutFieldConfig("XX")).toThrow(/not configured/i);
    expect(validPostcode("US", "12345-6789")).toBe(true);
    expect(validPostcode("CA", "K1A 0B1")).toBe(true);
    expect(validPostcode("AU", "4000")).toBe(true);
    expect(validPostcode("NZ", "6011")).toBe(true);
    expect(validPostcode("SG", "123456")).toBe(true);
    expect(validPostcode("IE", "")).toBe(true);
    expect(validPostcode("IE", "A65 F4E2")).toBe(true);
    expect(validPostcode("UK", "SW1A 1AA")).toBe(true);
    expect(validPostcode("AU", "400")).toBe(false);
    expect(normalizePostcode("CA", "k1a0b1")).toBe("K1A 0B1");
    expect(normalizePostcode("IE", "a65f4e2")).toBe("A65 F4E2");
    expect(normalizePostcode("AU", " 4000 ")).toBe("4000");
  });

  it("preserves only whitelisted ad params and a present coupon", () => {
    const query = preservedQuery("utm_source=meta&utm_campaign=dogs&utm_content=a&fbclid=1&coupon=SAVE&bad=no");
    expect(query.toString()).toContain("utm_source=meta");
    expect(query.get("bad")).toBeNull();
    expect(query.get("coupon")).toBe("SAVE");
    expect(preservedQuery("coupon=SAVE", false).get("coupon")).toBeNull();
    expect(internalUrl("/checkout", query, { offer: "2" })).toContain("offer=2");
    expect(internalUrl("/contact", "")).toBe("/contact");
  });

  it("interprets Stripe redirect_status without calling external services", () => {
    expect(interpretRedirectStatus("succeeded")).toBe("success");
    expect(interpretRedirectStatus(" FAILED ")).toBe("failure");
    expect(interpretRedirectStatus("processing")).toBe("unknown");
    expect(interpretRedirectStatus(null)).toBe("unknown");
  });

  it("filters checkout analytics and emits OfferSelect", () => {
    const payload = checkoutEventPayload("2", "AU", {
      cart: [{ listing: 1, quantity: 1 }],
      quote: [
        { was: 10, now: 10, currency: "AUD", tax: 0, lineTotal: 10, lineTax: 0, discount: 0, listing: 1, quantity: 1 },
        { was: 20, now: 20, currency: "AUD", tax: 0, lineTotal: 20, lineTax: 0, discount: 0, listing: 2, quantity: 1 },
      ],
      shippingCost: 0,
      discount: 0,
      currency: "AUD",
      tax: 0,
      subtotal: 30,
      total: 30,
      id: "q",
      shipping: 0,
      shippingCountry: "AU",
    });
    expect(payload).toEqual({ offer_option: "2", order_total_cents: 30, currency: "AUD", country: "AU", top_listing_id: 2 });
    const gtag = vi.fn();
    const fbq = vi.fn();
    window.gtag = gtag;
    window.fbq = fbq;
    trackEvent("OfferSelect", { offer_option: "2" });
    expect(gtag).toHaveBeenCalledWith("event", "OfferSelect", { offer_option: "2" });
    expect(fbq).toHaveBeenCalledWith("trackCustom", "OfferSelect", { offer_option: "2" });
    delete window.gtag;
    delete window.fbq;
  });

  it("keeps analytics safe when browser globals or payloads are absent", () => {
    expect(() => trackEvent("PageView")).not.toThrow();
    vi.stubGlobal("window", undefined);
    expect(() => trackEvent("PageView")).not.toThrow();
    vi.unstubAllGlobals();
  });
});
