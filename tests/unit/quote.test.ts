import { afterEach, describe, expect, it, vi } from "vitest";

import { highestLineTotalListing, isQuoteResponse, requestQuote, validateQuoteMoney, type QuoteResponse } from "@/lib/quote";

const quote: QuoteResponse = {
  cart: [{ listing: 1, option: "Default", quantity: 1, name: "PawTrim Reward Board" }],
  quote: [{
    was: 2495,
    now: 2495,
    currency: "AUD",
    tax: 0,
    lineTotal: 2495,
    lineTax: 0,
    discount: 0,
    listing: 1,
    option: "Default",
    quantity: 1,
    name: "PawTrim Reward Board",
  }],
  shippingCost: 0,
  discount: 0,
  currency: "AUD",
  tax: 0,
  subtotal: 2495,
  total: 2495,
  id: "quote-1",
  coupon: null,
  shipping: 0,
  shippingCountry: "AU",
};

const config = {
  GOOGLE_RECAPTCHA_SITE_KEY: "site-key",
  TENANT_ID: "tenant",
  shipping_option_id: 1,
  TARGET_COUNTRY: "AU",
  STORE_INTEGRATION_ENDPOINT: "https://store.example.test",
};

afterEach(() => {
  delete window.niobium;
});

describe("quote integration", () => {
  it("accepts valid cent-based quote data", () => {
    expect(isQuoteResponse(quote)).toBe(true);
    expect(validateQuoteMoney(quote)).toBe(quote);
    expect(highestLineTotalListing({
      ...quote,
      quote: [quote.quote[0], { ...quote.quote[0], listing: 2, lineTotal: 3000 }],
    })).toBe(2);
    expect(highestLineTotalListing({
      ...quote,
      quote: [quote.quote[0], { ...quote.quote[0], listing: 2, lineTotal: 1000 }],
    })).toBe(1);
    expect(isQuoteResponse({
      ...quote,
      shippingDescription: "Tracked delivery",
      coupon: "SAVE",
      taxInfo: { rate: 0.1, kind: 1 },
      quote: [{ ...quote.quote[0], taxInfo: { rate: 0.1, kind: 1 } }],
    })).toBe(true);
    expect(isQuoteResponse({
      ...quote,
      coupon: undefined,
      cart: [{ listing: 1, quantity: 1, option: undefined, name: undefined }],
      quote: [{ ...quote.quote[0], option: null, name: null }],
    })).toBe(true);
  });

  it.each([
    null,
    1,
    {},
    { ...quote, cart: [] },
    { ...quote, cart: [{}] },
    { ...quote, quote: [] },
    { ...quote, quote: [{}] },
    { ...quote, currency: "aud" },
    { ...quote, total: -1 },
    { ...quote, id: "" },
    { ...quote, shippingCountry: "" },
  ])("rejects malformed quote data %#", (value) => {
    expect(isQuoteResponse(value)).toBe(false);
  });

  it("rejects every malformed cart, money, optional, and tax-info branch", () => {
    const validCart = quote.cart[0];
    for (const item of [
      null,
      1,
      { ...validCart, listing: 0 },
      { ...validCart, quantity: 0 },
      { ...validCart, option: 1 },
      { ...validCart, name: 1 },
    ]) {
      expect(isQuoteResponse({ ...quote, cart: [item] })).toBe(false);
    }

    for (const field of ["was", "now", "tax", "lineTotal", "lineTax", "discount"] as const) {
      expect(isQuoteResponse({ ...quote, quote: [{ ...quote.quote[0], [field]: -1 }] })).toBe(false);
    }
    for (const field of ["shippingCost", "discount", "tax", "subtotal", "total", "shipping"] as const) {
      expect(isQuoteResponse({ ...quote, [field]: -1 })).toBe(false);
    }
    for (const value of [
      { ...quote, cart: "bad" },
      { ...quote, quote: "bad" },
      { ...quote, id: 1 },
      { ...quote, shippingCountry: 1 },
      { ...quote, shippingDescription: 1 },
      { ...quote, coupon: 1 },
      { ...quote, quote: [{ ...quote.quote[0], currency: "aud" }] },
      { ...quote, taxInfo: null },
      { ...quote, taxInfo: 1 },
      { ...quote, taxInfo: { rate: Number.NaN, kind: 1 } },
      { ...quote, taxInfo: { rate: 0.1, kind: 1.2 } },
      { ...quote, quote: [{ ...quote.quote[0], taxInfo: null }] },
    ]) {
      expect(isQuoteResponse(value)).toBe(false);
    }
  });

  it("calls the raw Response integration with numeric shippingId and STORE_INTEGRATION_ENDPOINT last", async () => {
    const getQuote = vi.fn().mockResolvedValue(new Response(JSON.stringify(quote), { status: 200 }));
    window.niobium = { store: { getQuote, makeOrder: vi.fn(), trackOrder: vi.fn() } };
    await expect(requestQuote(config, [{ Listing: 1, Option: "Default", Quantity: 1 }], "SAVE")).resolves.toEqual(quote);
    expect(getQuote).toHaveBeenCalledWith(
      "site-key",
      "tenant",
      1,
      "AU",
      [{ Listing: 1, Option: "Default", Quantity: 1 }],
      "SAVE",
      "https://store.example.test",
    );
    expect(typeof getQuote.mock.calls[0][2]).toBe("number");
  });

  it("requires the quote library and rejects invalid money", async () => {
    await expect(requestQuote(config, [], null)).rejects.toThrow(/still loading/i);
    expect(() => validateQuoteMoney({ ...quote, total: -1 })).toThrow(/cents/i);
  });

  it("rejects a non-numeric shipping ID before reaching the vendor boundary", async () => {
    const getQuote = vi.fn();
    window.niobium = { store: { getQuote, makeOrder: vi.fn(), trackOrder: vi.fn() } };
    await expect(requestQuote({ ...config, shipping_option_id: Number.NaN }, [], null)).rejects.toThrow(/SHIPPING_OPTION_ID/);
    await expect(requestQuote({ ...config, shipping_option_id: 0 }, [], null)).rejects.toThrow(/SHIPPING_OPTION_ID/);
    expect(getQuote).not.toHaveBeenCalled();
  });
});
