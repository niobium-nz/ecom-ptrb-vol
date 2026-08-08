import { describe, expect, it } from "vitest";

import {
  applyLiveQuotePrice,
  createImmediateOfferPrice,
  refreshOfferPriceInBackground,
} from "@/lib/offer-pricing";

describe("landing offer pricing", () => {
  const immediate = createImmediateOfferPrice({
    amount_cents: 2495,
    currency: "AUD",
  });

  it("provides an immediate cent-based default before any quote resolves", () => {
    expect(immediate).toEqual({
      amountCents: 2495,
      currency: "AUD",
      source: "default",
    });
  });

  it("replaces the default when a valid live quote differs", async () => {
    await expect(
      refreshOfferPriceInBackground(immediate, async () => ({
        total: 2395,
        currency: "AUD",
      })),
    ).resolves.toEqual({
      amountCents: 2395,
      currency: "AUD",
      source: "quote",
    });
  });

  it("marks a matching valid quote as live without changing the amount", () => {
    expect(applyLiveQuotePrice({ total: 2495, currency: "aud" })).toEqual({
      amountCents: 2495,
      currency: "AUD",
      source: "quote",
    });
  });

  it("retains the exact immediate object when the background quote fails", async () => {
    await expect(
      refreshOfferPriceInBackground(immediate, async () => {
        throw new Error("network");
      }),
    ).resolves.toBe(immediate);
  });

  it.each([
    { amount_cents: 0, currency: "AUD" },
    { amount_cents: -1, currency: "AUD" },
    { amount_cents: 1.5, currency: "AUD" },
    { amount_cents: 2495, currency: "" },
    { amount_cents: 2495, currency: "AU" },
    { amount_cents: 2495, currency: 123 as unknown as string },
  ])("rejects an invalid default price %#", (defaultPrice) => {
    expect(() => createImmediateOfferPrice(defaultPrice)).toThrow();
  });

  it.each([
    { total: -1, currency: "AUD" },
    { total: 1.5, currency: "AUD" },
    { total: 2495, currency: "" },
    { total: 2495, currency: "AUDD" },
    { total: 2495, currency: null as unknown as string },
  ])("rejects an invalid quote price %#", (quote) => {
    expect(() => applyLiveQuotePrice(quote)).toThrow();
  });
});
