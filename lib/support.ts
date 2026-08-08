import { callVendorJson } from "@/lib/vendor-response";

export type NotificationConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: string;
  TENANT_ID: string;
  APP_NAME: string;
  NOTIFICATION_INTEGRATION_ENDPOINT: string;
};

export type TrackingConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: string;
  STORE_INTEGRATION_ENDPOINT: string;
};

export type TrackResponse = {
  created: string;
  status: number;
  cart: Array<{ listing: number; option: string; quantity: number; name?: string | null }>;
  shippingStatus: number;
  shippingCity: string;
  shippingState?: string | null;
  shippingCountry: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTrackResponse(value: unknown): value is TrackResponse {
  if (!isObject(value)) return false;
  return (
    typeof value.created === "string" &&
    Boolean(value.created.trim()) &&
    Number.isSafeInteger(value.status) &&
    Array.isArray(value.cart) &&
    value.cart.every((item) =>
      Boolean(
        isObject(item) &&
          Number.isSafeInteger(item.listing) &&
          (item.listing as number) > 0 &&
          typeof item.option === "string" &&
          Number.isSafeInteger(item.quantity) &&
          (item.quantity as number) > 0 &&
          (item.name === undefined || item.name === null || typeof item.name === "string"),
      ),
    ) &&
    Number.isSafeInteger(value.shippingStatus) &&
    typeof value.shippingCity === "string" &&
    typeof value.shippingCountry === "string"
  );
}

export async function subscribeToUpdates(config: NotificationConfig, email: string): Promise<Record<string, unknown>> {
  const candidate = window.niobium;
  if (!candidate?.notification?.subscribe) throw new Error("Email updates are still loading. Please try again in a moment.");
  const niobium = candidate as {
    notification: NonNullable<NonNullable<Window["niobium"]>["notification"]>;
  };
  const { GOOGLE_RECAPTCHA_SITE_KEY, TENANT_ID, APP_NAME, NOTIFICATION_INTEGRATION_ENDPOINT } = config;
  return callVendorJson(
    "subscribe",
    () => niobium.notification.subscribe(
      GOOGLE_RECAPTCHA_SITE_KEY,
      TENANT_ID,
      APP_NAME,
      email.trim(),
      "",
      "",
      "",
      NOTIFICATION_INTEGRATION_ENDPOINT
    ),
    isObject,
  );
}

export async function sendContactMessage(
  config: NotificationConfig,
  name: string,
  email: string,
  message: string,
): Promise<Record<string, unknown>> {
  const candidate = window.niobium;
  if (!candidate?.notification?.contactUs) throw new Error("The contact form is still loading. Please try again in a moment.");
  const niobium = candidate as {
    notification: NonNullable<NonNullable<Window["niobium"]>["notification"]>;
  };
  const { GOOGLE_RECAPTCHA_SITE_KEY, TENANT_ID, NOTIFICATION_INTEGRATION_ENDPOINT } = config;
  return callVendorJson(
    "contact",
    () => niobium.notification.contactUs(
      GOOGLE_RECAPTCHA_SITE_KEY,
      TENANT_ID,
      name.trim(),
      email.trim(),
      message.trim(),
      NOTIFICATION_INTEGRATION_ENDPOINT
    ),
    isObject,
  );
}

export async function trackOrder(
  config: TrackingConfig,
  lookup: { email: string; order: number } | { email: string; firstName: string },
): Promise<TrackResponse> {
  const candidate = window.niobium;
  if (!candidate?.store?.trackOrder) throw new Error("Order tracking is still loading. Please try again in a moment.");
  const niobium = candidate as {
    store: NonNullable<NonNullable<Window["niobium"]>["store"]>;
  };
  const { GOOGLE_RECAPTCHA_SITE_KEY, STORE_INTEGRATION_ENDPOINT } = config;
  return callVendorJson(
    "track_order",
    () => niobium.store.trackOrder(
      GOOGLE_RECAPTCHA_SITE_KEY,
      lookup,
      STORE_INTEGRATION_ENDPOINT
    ),
    isTrackResponse,
  );
}
