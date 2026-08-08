import { requireNonNegativeCents } from "./utils";

export type InputDefaultPrice = {
  amount_cents: number;
  currency: string;
};

export type QuotePrice = {
  total: number;
  currency: string;
};

export type DisplayOfferPrice = {
  amountCents: number;
  currency: string;
  source: "default" | "quote";
};

function requireCurrency(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be an uppercase three-letter currency code`);
  }
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`${name} must be an uppercase three-letter currency code`);
  }
  return currency;
}

export function createImmediateOfferPrice(
  defaultPrice: InputDefaultPrice,
): DisplayOfferPrice {
  const amountCents = requireNonNegativeCents(
    "default_price.amount_cents",
    defaultPrice.amount_cents,
  );
  if (amountCents === 0) {
    throw new Error("default_price.amount_cents must be greater than zero");
  }
  return {
    amountCents,
    currency: requireCurrency(defaultPrice.currency, "default_price.currency"),
    source: "default",
  };
}

export function applyLiveQuotePrice(
  quote: QuotePrice,
): DisplayOfferPrice {
  return {
    amountCents: requireNonNegativeCents("quote.total", quote.total),
    currency: requireCurrency(quote.currency, "quote.currency"),
    source: "quote",
  };
}

export async function refreshOfferPriceInBackground(
  immediatePrice: DisplayOfferPrice,
  loadQuote: () => Promise<QuotePrice>,
): Promise<DisplayOfferPrice> {
  try {
    return applyLiveQuotePrice(await loadQuote());
  } catch {
    // Landing-page live pricing is non-blocking. Checkout must not use this helper.
    return immediatePrice;
  }
}
