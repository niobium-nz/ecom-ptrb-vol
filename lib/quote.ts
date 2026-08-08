import type { VendorCartItem } from "@/lib/offers";
import { requireNonNegativeCents } from "@/lib/utils";
import { callVendorJson } from "@/lib/vendor-response";

export type QuoteCartItem = {
  listing: number;
  option?: string | null;
  quantity: number;
  name?: string | null;
};

export type TaxInfo = {
  rate: number;
  kind: number;
};

export type QuoteLine = {
  was: number;
  now: number;
  currency: string;
  tax: number;
  lineTotal: number;
  lineTax: number;
  discount: number;
  listing: number;
  option?: string | null;
  quantity: number;
  name?: string | null;
  taxInfo?: TaxInfo;
};

export type QuoteResponse = {
  cart: QuoteCartItem[];
  quote: QuoteLine[];
  shippingCost: number;
  shippingDescription?: string;
  discount: number;
  currency: string;
  tax: number;
  subtotal: number;
  total: number;
  id: string;
  coupon?: string | null;
  shipping: number;
  shippingCountry: string;
  taxInfo?: TaxInfo;
};

export type StoreQuoteConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: string;
  TENANT_ID: string;
  shipping_option_id: number;
  TARGET_COUNTRY: string;
  STORE_INTEGRATION_ENDPOINT: string;
};

function validCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function validCartItem(value: unknown): value is QuoteCartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as QuoteCartItem;
  return (
    Number.isSafeInteger(item.listing) &&
    item.listing > 0 &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity > 0 &&
    (item.option === undefined || item.option === null || typeof item.option === "string") &&
    (item.name === undefined || item.name === null || typeof item.name === "string")
  );
}

function validTaxInfo(value: unknown): value is TaxInfo {
  if (!value || typeof value !== "object") return false;
  const taxInfo = value as TaxInfo;
  return Number.isFinite(taxInfo.rate) && Number.isSafeInteger(taxInfo.kind);
}

function validQuoteLine(value: unknown): value is QuoteLine {
  if (!validCartItem(value)) return false;
  const line = value as QuoteLine;
  return (
    [line.was, line.now, line.tax, line.lineTotal, line.lineTax, line.discount].every(
      (amount) => Number.isSafeInteger(amount) && amount >= 0,
    ) &&
    validCurrency(line.currency) &&
    (line.taxInfo === undefined || validTaxInfo(line.taxInfo))
  );
}

export function isQuoteResponse(value: unknown): value is QuoteResponse {
  if (!value || typeof value !== "object") return false;
  const quote = value as QuoteResponse;
  return (
    Array.isArray(quote.cart) &&
    quote.cart.length > 0 &&
    quote.cart.every(validCartItem) &&
    Array.isArray(quote.quote) &&
    quote.quote.length > 0 &&
    quote.quote.every(validQuoteLine) &&
    [quote.shippingCost, quote.discount, quote.tax, quote.subtotal, quote.total, quote.shipping].every(
      (amount) => Number.isSafeInteger(amount) && amount >= 0,
    ) &&
    validCurrency(quote.currency) &&
    typeof quote.id === "string" &&
    Boolean(quote.id.trim()) &&
    typeof quote.shippingCountry === "string" &&
    Boolean(quote.shippingCountry.trim()) &&
    (quote.shippingDescription === undefined || typeof quote.shippingDescription === "string") &&
    (quote.coupon === undefined || quote.coupon === null || typeof quote.coupon === "string") &&
    (quote.taxInfo === undefined || validTaxInfo(quote.taxInfo))
  );
}

function requireShippingId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("SHIPPING_OPTION_ID must be a safe positive integer.");
  }
  return value;
}

export async function requestQuote(
  config: StoreQuoteConfig,
  cartItems: VendorCartItem[],
  coupon: string | null,
): Promise<QuoteResponse> {
  const {
    GOOGLE_RECAPTCHA_SITE_KEY,
    TENANT_ID,
    shipping_option_id,
    TARGET_COUNTRY,
    STORE_INTEGRATION_ENDPOINT,
  } = config;
  const shippingId = requireShippingId(shipping_option_id);
  const candidate = window.niobium;
  if (!candidate?.store?.getQuote) throw new Error("Pricing is still loading. Please try again in a moment.");
  const niobium = candidate as {
    store: NonNullable<NonNullable<Window["niobium"]>["store"]>;
  };
  return callVendorJson(
    "quote",
    () => niobium.store.getQuote(
      GOOGLE_RECAPTCHA_SITE_KEY,
      TENANT_ID,
      shippingId,
      TARGET_COUNTRY,
      cartItems,
      coupon,
      STORE_INTEGRATION_ENDPOINT
    ),
    isQuoteResponse,
  );
}

export function highestLineTotalListing(quote: QuoteResponse): number {
  const highest = quote.quote.reduce((current, line) =>
    line.lineTotal > current.lineTotal ? line : current,
  );
  return highest.listing;
}

export function validateQuoteMoney(quote: QuoteResponse): QuoteResponse {
  for (const [name, value] of Object.entries({
    shippingCost: quote.shippingCost,
    discount: quote.discount,
    tax: quote.tax,
    subtotal: quote.subtotal,
    total: quote.total,
    shipping: quote.shipping,
  })) {
    requireNonNegativeCents(name, value);
  }
  return quote;
}
