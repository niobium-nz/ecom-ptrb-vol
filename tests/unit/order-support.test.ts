import { afterEach, describe, expect, it, vi } from "vitest";

import { buildConsignee, buildOrderPayload, requestOrder, type CheckoutDetails } from "@/lib/order";
import { sendContactMessage, subscribeToUpdates, trackOrder } from "@/lib/support";

const storeConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: "site-key",
  TENANT_ID: "tenant",
  shipping_option_id: 1,
  TARGET_COUNTRY: "AU",
  STORE_INTEGRATION_ENDPOINT: "https://store.example.test",
};

const notificationConfig = {
  GOOGLE_RECAPTCHA_SITE_KEY: "site-key",
  TENANT_ID: "tenant",
  APP_NAME: "niobiumecomm-ptrb-vol-dev",
  NOTIFICATION_INTEGRATION_ENDPOINT: "https://notification.example.test",
};

const details: CheckoutDetails = {
  email: " jo@example.com ",
  firstName: " Jo ",
  lastName: " Smith ",
  phone: " 0400000000 ",
  shippingAddressLine1: " 1 Paw Street ",
  shippingAddressLine2: " Unit 2 ",
  shippingCity: " Brisbane ",
  shippingSuburb: " West End ",
  shippingState: " QLD ",
  shippingPostcode: " 4000 ",
  notes: " Leave at door ",
  marketingSubscription: true,
  billingSameAsShipping: true,
};

afterEach(() => {
  delete window.niobium;
});

describe("order construction and vendor routing", () => {
  it("builds a same-as-shipping payload with numeric shippingId", () => {
    expect(buildConsignee(" Jo ", " Smith ")).toBe("Jo Smith");
    expect(buildConsignee("Jo")).toBe("Jo");
    const payload = buildOrderPayload({
      config: storeConfig,
      details,
      cart: [{ Listing: 1, Option: "Default", Quantity: 1 }],
      coupon: "SAVE",
      culture: "en-AU",
      timeZone: "Australia/Brisbane",
    });
    expect(payload).toMatchObject({
      shippingId: 1,
      shippingCountry: "AU",
      billingCountry: "AU",
      consignee: "Jo Smith",
      billingName: "Jo Smith",
      email: "jo@example.com",
      billingAddressLine1: "1 Paw Street",
      billingAddressLine2: "Unit 2",
      billingCity: "Brisbane",
      billingSuburb: "West End",
      billingState: "QLD",
      billingPostcode: "4000",
      culture: "en-AU",
      timeZone: "Australia/Brisbane",
    });
    expect(typeof payload.shippingId).toBe("number");
  });

  it("uses separate billing details and defaults optional values", () => {
    const payload = buildOrderPayload({
      config: storeConfig,
      details: {
        ...details,
        lastName: undefined,
        phone: undefined,
        shippingAddressLine2: undefined,
        shippingSuburb: undefined,
        shippingState: undefined,
        notes: undefined,
        billingSameAsShipping: false,
        billingName: "A Customer",
        billingAddressLine1: "2 Bill Road",
        billingAddressLine2: "Suite 4",
        billingCity: "Sydney",
        billingSuburb: "CBD",
        billingState: "NSW",
        billingPostcode: "2000",
      },
      cart: [{ Listing: 1, Option: "Default", Quantity: 1 }],
      coupon: null,
    });
    expect(payload).toMatchObject({
      consignee: "Jo",
      phone: "",
      notes: "",
      shippingAddressLine2: "",
      shippingSuburb: "",
      shippingState: "",
      billingName: "A Customer",
      billingAddressLine1: "2 Bill Road",
      billingAddressLine2: "Suite 4",
      billingCity: "Sydney",
      billingSuburb: "CBD",
      billingState: "NSW",
      billingPostcode: "2000",
      culture: "en-AU",
      timeZone: "Australia/Sydney",
    });
  });

  it("defaults omitted optional billing values in both address modes", () => {
    const sameAddress = buildOrderPayload({
      config: storeConfig,
      details: {
        ...details,
        shippingAddressLine2: undefined,
        shippingSuburb: undefined,
        shippingState: undefined,
      },
      cart: [],
      coupon: null,
    });
    expect(sameAddress).toMatchObject({
      billingAddressLine2: "",
      billingSuburb: "",
      billingState: "",
    });

    const separateAddress = buildOrderPayload({
      config: storeConfig,
      details: {
        ...details,
        billingSameAsShipping: false,
        billingName: undefined,
        billingAddressLine1: undefined,
        billingAddressLine2: undefined,
        billingCity: undefined,
        billingSuburb: undefined,
        billingState: undefined,
        billingPostcode: undefined,
      },
      cart: [],
      coupon: null,
    });
    expect(separateAddress).toMatchObject({
      billingName: "",
      billingAddressLine1: "",
      billingAddressLine2: "",
      billingCity: "",
      billingSuburb: "",
      billingState: "",
      billingPostcode: "",
    });
  });

  it("rejects a non-numeric shipping setting", () => {
    expect(() => buildOrderPayload({
      config: { ...storeConfig, shipping_option_id: 0 },
      details,
      cart: [],
      coupon: null,
    })).toThrow(/SHIPPING_OPTION_ID/);
  });

  it("rejects a mismatched shippingId at the makeOrder boundary", async () => {
    const makeOrder = vi.fn();
    window.niobium = { store: { getQuote: vi.fn(), makeOrder, trackOrder: vi.fn() } };
    const payload = buildOrderPayload({ config: storeConfig, details, cart: [], coupon: null });
    await expect(requestOrder(storeConfig, { ...payload, shippingId: 2 })).rejects.toThrow(/SHIPPING_OPTION_ID/);
    expect(makeOrder).not.toHaveBeenCalled();
  });

  it("calls makeOrder through a raw Response and keeps STORE_INTEGRATION_ENDPOINT final", async () => {
    const makeOrder = vi.fn().mockResolvedValue(new Response(JSON.stringify({ instruction: "secret" }), { status: 200 }));
    window.niobium = { store: { getQuote: vi.fn(), makeOrder, trackOrder: vi.fn() } };
    const payload = buildOrderPayload({ config: storeConfig, details, cart: [], coupon: null });
    await expect(requestOrder(storeConfig, payload)).resolves.toEqual({ instruction: "secret" });
    expect(makeOrder).toHaveBeenCalledWith("site-key", "tenant", payload, "https://store.example.test");
  });

  it("requires the order library and validates instructions", async () => {
    await expect(requestOrder(storeConfig, {} as never)).rejects.toThrow(/still loading/i);
    window.niobium = {
      store: {
        getQuote: vi.fn(),
        makeOrder: vi.fn().mockResolvedValue(new Response(JSON.stringify({ instruction: "" }), { status: 200 })),
        trackOrder: vi.fn(),
      },
    };
    const payload = buildOrderPayload({
      config: storeConfig,
      details,
      cart: [],
      coupon: null,
    });
    await expect(requestOrder(storeConfig, payload)).rejects.toMatchObject({ kind: "invalid_body" });
  });
});

describe("support integrations", () => {
  it("routes subscription and contact to NOTIFICATION_INTEGRATION_ENDPOINT last", async () => {
    const subscribe = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const contactUs = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    window.niobium = { notification: { subscribe, contactUs } };
    await subscribeToUpdates(notificationConfig, " hello@example.com ");
    await sendContactMessage(notificationConfig, "Jo", "jo@example.com", "Help please");
    expect(subscribe).toHaveBeenCalledWith(
      "site-key",
      "tenant",
      "niobiumecomm-ptrb-vol-dev",
      "hello@example.com",
      "",
      "",
      "",
      "https://notification.example.test",
    );
    expect(contactUs).toHaveBeenCalledWith(
      "site-key",
      "tenant",
      "Jo",
      "jo@example.com",
      "Help please",
      "https://notification.example.test",
    );
  });

  it("routes both tracking modes to STORE_INTEGRATION_ENDPOINT last", async () => {
    const body = {
      created: "2026-01-01",
      status: 20,
      cart: [],
      shippingStatus: 1,
      shippingCity: "Sydney",
      shippingCountry: "AU",
    };
    const trackOrderMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 200 }));
    window.niobium = { store: { getQuote: vi.fn(), makeOrder: vi.fn(), trackOrder: trackOrderMock } };
    const config = { GOOGLE_RECAPTCHA_SITE_KEY: "site-key", STORE_INTEGRATION_ENDPOINT: "https://store.example.test" };
    await expect(trackOrder(config, { email: "jo@example.com", order: 123 })).resolves.toEqual(body);
    await trackOrder(config, { email: "jo@example.com", firstName: "jo" });
    expect(trackOrderMock.mock.calls[0].at(-1)).toBe("https://store.example.test");
    expect(trackOrderMock.mock.calls[1].at(-1)).toBe("https://store.example.test");
  });

  it("requires each vendor library and validates response bodies", async () => {
    await expect(subscribeToUpdates(notificationConfig, "a@b.com")).rejects.toThrow(/still loading/i);
    await expect(sendContactMessage(notificationConfig, "A", "a@b.com", "Hi")).rejects.toThrow(/still loading/i);
    await expect(trackOrder({ GOOGLE_RECAPTCHA_SITE_KEY: "key", STORE_INTEGRATION_ENDPOINT: "store" }, { email: "a@b.com", order: 1 })).rejects.toThrow(/still loading/i);

    window.niobium = {
      notification: {
        subscribe: vi.fn().mockResolvedValue(new Response("null", { status: 200 })),
        contactUs: vi.fn().mockResolvedValue(new Response("[]", { status: 200 })),
      },
      store: {
        getQuote: vi.fn(),
        makeOrder: vi.fn(),
        trackOrder: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "bad" }), { status: 200 })),
      },
    };
    await expect(subscribeToUpdates(notificationConfig, "a@b.com")).rejects.toMatchObject({ kind: "protocol" });
    await expect(sendContactMessage(notificationConfig, "A", "a@b.com", "Hi")).rejects.toMatchObject({ kind: "invalid_body" });
    await expect(trackOrder({ GOOGLE_RECAPTCHA_SITE_KEY: "key", STORE_INTEGRATION_ENDPOINT: "store" }, { email: "a@b.com", order: 1 })).rejects.toMatchObject({ kind: "invalid_body" });

    window.niobium.store!.trackOrder = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await expect(trackOrder({ GOOGLE_RECAPTCHA_SITE_KEY: "key", STORE_INTEGRATION_ENDPOINT: "store" }, { email: "a@b.com", order: 1 })).rejects.toMatchObject({ kind: "invalid_body" });
  });
});
