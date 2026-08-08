import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
  type Request,
} from "@playwright/test";

const knownExternalDiagnostics = [
  {
    source: /^(?:chrome|moz|edge)-extension:|contentscript\.js/i,
    message: /ObjectMultiplex - orphaned data for stream ["'](?:app-init-liveness|background-liveness)["']/i,
  },
  {
    source: /^(?:chrome|moz|edge)-extension:|contentscript\.js/i,
    message: /MaxListenersExceededWarning: Possible EventEmitter memory leak detected/i,
  },
  {
    source: /(?:google\.com|gstatic\.com)\/recaptcha|recaptcha__/i,
    message: /Unrecognized feature:\s*["']private-token["']/i,
  },
];

function knownExternalConsole(message: ConsoleMessage, firstPartyOrigin: string) {
  const sourceUrl = message.location().url ?? "";
  let firstParty = false;
  try {
    firstParty = Boolean(sourceUrl) && new URL(sourceUrl).origin === firstPartyOrigin;
  } catch {
    firstParty = false;
  }
  return !firstParty && Boolean(sourceUrl) && knownExternalDiagnostics.some(
    (entry) => entry.source.test(sourceUrl) && entry.message.test(message.text()),
  );
}

async function installExternalMocks(page: Page) {
  for (const pattern of [
    "https://assets.store.niobium.co.nz/**",
    "https://assets.notification.niobium.co.nz/**",
  ]) {
    await page.route(pattern, (route) =>
      route.fulfill({ contentType: "application/javascript", body: "/* deterministic vendor mock */" }),
    );
  }
  for (const pattern of [
    "https://www.googletagmanager.com/**",
    "https://connect.facebook.net/**",
    "https://www.clarity.ms/**",
  ]) {
    await page.route(pattern, (route) =>
      route.fulfill({ contentType: "application/javascript", body: "/* deterministic analytics mock */" }),
    );
  }
  await page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Stripe = function Stripe() {
   return {
     _registerWrapper: function _registerWrapper() {},
     registerAppInfo: function registerAppInfo() {},
     createToken: function createToken() { return Promise.resolve({}); },
     createPaymentMethod: function createPaymentMethod() { return Promise.resolve({}); },
     confirmCardPayment: function confirmCardPayment() { return Promise.resolve({}); },
     elements: function elements() {
      return {
        create: function create() {
          var handlers = {};
          return {
            on: function on(name, handler) { handlers[name] = handler; },
            off: function off(name) { delete handlers[name]; },
            mount: function mount() { setTimeout(function () { if (handlers.ready) handlers.ready(); }, 0); },
            destroy: function destroy() {},
            update: function update() {},
            collapse: function collapse() { return Promise.resolve(); }
          };
        },
        submit: function submit() { return Promise.resolve({}); },
        update: function update() {}
      };
    },
    confirmPayment: function confirmPayment() { return Promise.resolve({}); }
  };
};
 window.Stripe.version = "dahlia";`,
    }),
  );

  await page.addInitScript(() => {
    const quoteBody = (...args: unknown[]) => {
      const cart = args[4] as Array<{ Listing: number; Option: string; Quantity: number }>;
      const coupon = typeof args[5] === "string" && args[5] ? args[5] : null;
      const quantity = cart.reduce((total, item) => total + item.Quantity, 0);
      const total = quantity === 1 ? 2495 : quantity === 6 ? 3995 : 5495;
      return {
        cart: cart.map((item) => ({
          listing: item.Listing,
          option: item.Option,
          quantity: item.Quantity,
          name: "PawTrim Reward Board",
        })),
        quote: cart.map((item) => ({
          was: total,
          now: total,
          currency: "AUD",
          tax: 0,
          lineTotal: total,
          lineTax: 0,
          discount: 0,
          listing: item.Listing,
          option: item.Option,
          quantity: item.Quantity,
          name: "PawTrim Reward Board",
        })),
        shippingCost: 0,
        shippingDescription: "Tracked delivery",
        discount: 0,
        currency: "AUD",
        tax: 0,
        subtotal: total,
        total,
        id: `e2e-quote-${quantity}-${coupon ?? "none"}`,
        coupon,
        shipping: 0,
        shippingCountry: "AU",
      };
    };

    window.niobium = {
      store: {
        getQuote: (...args: unknown[]) => Promise.resolve(new Response(JSON.stringify(quoteBody(...args)), { status: 200 })),
        makeOrder: () => Promise.resolve(new Response(JSON.stringify({ instruction: "e2e-client-secret" }), { status: 200 })),
        trackOrder: () => Promise.resolve(new Response(JSON.stringify({
            created: "2026-08-07",
            status: 30,
            cart: [{ listing: 1, option: "Default", quantity: 1, name: "PawTrim Reward Board" }],
            shippingStatus: 3,
            shippingCity: "Sydney",
            shippingState: "NSW",
            shippingCountry: "AU",
        }), { status: 200 })),
      },
      notification: {
        subscribe: () => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
        contactUs: () => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
      },
    };
  });
}

export const test = base.extend({
  page: async ({ page, baseURL }, providePage) => {
    const firstPartyOrigin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const defects: string[] = [];
    const firstPartyFailures: Request[] = [];
    page.on("console", (message) => {
      if (!["warning", "error"].includes(message.type())) return;
      if (!knownExternalConsole(message, firstPartyOrigin)) {
        defects.push(`console.${message.type()}: ${message.text()} (${message.location().url || "unknown source"})`);
      }
    });
    page.on("pageerror", (error) => defects.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => {
      try {
        if (new URL(request.url()).origin === firstPartyOrigin) {
          firstPartyFailures.push(request);
        }
      } catch {
        defects.push(`requestfailed with invalid URL: ${request.url()}`);
      }
    });
    await installExternalMocks(page);
    await providePage(page);
    for (const request of firstPartyFailures) {
      const requestedUrl = new URL(request.url());
      const expectedCanceledHomePrefetch =
        request.method() === "HEAD" &&
        request.resourceType() === "fetch" &&
        request.failure()?.errorText === "net::ERR_ABORTED" &&
        requestedUrl.origin === firstPartyOrigin &&
        requestedUrl.pathname === "/" &&
        requestedUrl.search === "";
      if (!expectedCanceledHomePrefetch) {
        defects.push(
          `first-party requestfailed: ${request.method()} ${request.resourceType()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
        );
      }
    }
    expect(defects, "browser console/page/request defects").toEqual([]);
  },
});

export { expect };
