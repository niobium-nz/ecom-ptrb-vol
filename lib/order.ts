import type { VendorCartItem } from "@/lib/offers";
import { callVendorJson } from "@/lib/vendor-response";

export type CheckoutDetails = {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingCity: string;
  shippingSuburb?: string;
  shippingState?: string;
  shippingPostcode: string;
  notes?: string;
  marketingSubscription: boolean;
  billingSameAsShipping: boolean;
  billingName?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingSuburb?: string;
  billingState?: string;
  billingPostcode?: string;
};

export type OrderPayload = {
  shippingId: number;
  shippingCountry: string;
  consignee: string;
  email: string;
  shippingAddressLine1: string;
  shippingCity: string;
  shippingPostcode: string;
  billingName: string;
  billingAddressLine1: string;
  billingCity: string;
  billingCountry: string;
  billingPostcode: string;
  cart: VendorCartItem[];
  coupon: string | null;
  notes: string;
  phone: string;
  shippingAddressLine2: string;
  shippingSuburb: string;
  shippingState: string;
  billingBusiness: string;
  billingAddressLine2: string;
  billingSuburb: string;
  billingState: string;
  marketingSubscription: boolean;
  track: string;
  culture: string;
  timeZone: string;
};

export type StoreOrderConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: string;
  TENANT_ID: string;
  shipping_option_id: number;
  TARGET_COUNTRY: string;
  STORE_INTEGRATION_ENDPOINT: string;
};

export type OrderResponse = { instruction: string } & Record<string, unknown>;

export function buildConsignee(firstName: string, lastName?: string): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

export function buildOrderPayload(options: {
  config: StoreOrderConfig;
  details: CheckoutDetails;
  cart: VendorCartItem[];
  coupon: string | null;
  culture?: string;
  timeZone?: string;
}): OrderPayload {
  const { config, details, cart, coupon } = options;
  if (!Number.isSafeInteger(config.shipping_option_id) || config.shipping_option_id <= 0) {
    throw new Error("SHIPPING_OPTION_ID must be a safe positive integer.");
  }
  const consignee = buildConsignee(details.firstName, details.lastName);
  const billingName = details.billingSameAsShipping ? consignee : details.billingName?.trim() ?? "";
  const billingAddressLine1 = details.billingSameAsShipping
    ? details.shippingAddressLine1.trim()
    : details.billingAddressLine1?.trim() ?? "";
  const billingAddressLine2 = details.billingSameAsShipping
    ? details.shippingAddressLine2?.trim() ?? ""
    : details.billingAddressLine2?.trim() ?? "";
  const billingCity = details.billingSameAsShipping ? details.shippingCity.trim() : details.billingCity?.trim() ?? "";
  const billingSuburb = details.billingSameAsShipping
    ? details.shippingSuburb?.trim() ?? ""
    : details.billingSuburb?.trim() ?? "";
  const billingState = details.billingSameAsShipping
    ? details.shippingState?.trim() ?? ""
    : details.billingState?.trim() ?? "";
  const billingPostcode = details.billingSameAsShipping
    ? details.shippingPostcode.trim()
    : details.billingPostcode?.trim() ?? "";

  return {
    shippingId: config.shipping_option_id,
    shippingCountry: config.TARGET_COUNTRY,
    consignee,
    email: details.email.trim(),
    shippingAddressLine1: details.shippingAddressLine1.trim(),
    shippingCity: details.shippingCity.trim(),
    shippingPostcode: details.shippingPostcode.trim(),
    billingName,
    billingAddressLine1,
    billingCity,
    billingCountry: config.TARGET_COUNTRY,
    billingPostcode,
    cart,
    coupon,
    notes: details.notes?.trim() ?? "",
    phone: details.phone?.trim() ?? "",
    shippingAddressLine2: details.shippingAddressLine2?.trim() ?? "",
    shippingSuburb: details.shippingSuburb?.trim() ?? "",
    shippingState: details.shippingState?.trim() ?? "",
    billingBusiness: "",
    billingAddressLine2,
    billingSuburb,
    billingState,
    marketingSubscription: details.marketingSubscription,
    track: "",
    culture: options.culture ?? "en-AU",
    timeZone: options.timeZone ?? "Australia/Sydney",
  };
}

function isOrderResponse(value: unknown): value is OrderResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as OrderResponse).instruction === "string" &&
      (value as OrderResponse).instruction.trim(),
  );
}

export async function requestOrder(
  config: StoreOrderConfig,
  payload: OrderPayload,
): Promise<OrderResponse> {
  const candidate = window.niobium;
  if (!candidate?.store?.makeOrder) throw new Error("Secure payment is still loading. Please try again in a moment.");
  const niobium = candidate as {
    store: NonNullable<NonNullable<Window["niobium"]>["store"]>;
  };
  if (
    !Number.isSafeInteger(config.shipping_option_id) ||
    config.shipping_option_id <= 0 ||
    !Number.isSafeInteger(payload.shippingId) ||
    payload.shippingId !== config.shipping_option_id
  ) {
    throw new Error("SHIPPING_OPTION_ID must be a safe positive integer.");
  }
  const { GOOGLE_RECAPTCHA_SITE_KEY, TENANT_ID, STORE_INTEGRATION_ENDPOINT } = config;
  return callVendorJson(
    "order",
    () => niobium.store.makeOrder(
      GOOGLE_RECAPTCHA_SITE_KEY,
      TENANT_ID,
      payload,
      STORE_INTEGRATION_ENDPOINT
    ),
    isOrderResponse,
  );
}
