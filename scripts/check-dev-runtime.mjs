import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { isDirectExecution, runCli } from "./cli.mjs";

const DEV_HOST = "0.0.0.0";

export const STRIPE_FIXTURE_SCRIPT = `window.Stripe = function Stripe() {
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
window.Stripe.version = "dahlia";`;

export const MOBILE_VIEWPORTS = [
  { name: "small-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "iphone-390", width: 390, height: 844 },
  { name: "large-phone-430", width: 430, height: 932 },
];

// Expected informational messages include "Download the React DevTools for a better development experience" and "[HMR] connected".
export const EXPECTED_INFORMATIONAL_DEV_MESSAGES = [
  /Download the React DevTools for a better development experience/i,
  /^\[HMR\] connected$/i,
];

const FORBIDDEN_CUSTOMER_PATTERNS = [
  ["em dash", /\u2014/],
  ["owner-facing checkout phrase", /\ba focused,?\s+guest checkout\b/i],
  ["guest-checkout meta copy", /\bguest checkout\b/i],
  ["conversion meta copy", /\bconversion[- ]focused\b/i],
  ["friction meta copy", /\blow[- ]friction\b|\breduce friction\b/i],
  ["operator offer terminology", /\boffer stack\b|\bmessage match(?:ed)?\b|\bpurchase flow\b/i],
  ["ambiguous coupon label", /\bactive coupon\b/i],
];

const KNOWN_EXTERNAL_CONSOLE_DIAGNOSTICS = [
  {
    label: "browser-extension ObjectMultiplex liveness diagnostic",
    source: /^(?:chrome|moz|edge)-extension:|contentscript\.js/i,
    message: /ObjectMultiplex - orphaned data for stream ["\'](?:app-init-liveness|background-liveness)["\']/i,
  },
  {
    label: "browser-extension listener diagnostic",
    source: /^(?:chrome|moz|edge)-extension:|contentscript\.js/i,
    message: /MaxListenersExceededWarning: Possible EventEmitter memory leak detected/i,
  },
  {
    label: "Google reCAPTCHA private-token feature diagnostic",
    source: /(?:google\.com|gstatic\.com)\/recaptcha|recaptcha__/i,
    message: /Unrecognized feature:\s*["\']private-token["\']/i,
  },
];

const REQUIRED_ROUTES = [
  "/",
  "/checkout?offer=1",
  "/contact",
  "/track-order",
  "/order-status",
  "/privacy-policy",
  "/terms",
  "/returns-policy",
  "/shipping-policy",
];

const SERVER_FAILURE_PATTERNS = [
  ["warning marker", /⚠|\bwarning\b|\bnpm warn\b/i],
  ["cross-origin warning", /cross[- ]origin request detected|allowedDevOrigins/i],
  ["outdated dependency notice", /outdated version|newer version is available|version staleness/i],
  ["source-map failure", /could not read source map|failed to (?:read|load) source map/i],
  ["deprecation", /\bdeprecated\b|deprecationwarning/i],
  ["unhandled failure", /unhandled(?:rejection|promise)|uncaught exception/i],
  ["runtime exception", /\b(?:TypeError|ReferenceError|RangeError|SyntaxError):/],
  ["hydration failure", /hydration (?:failed|error)|did not match/i],
];


export function classifyBrowserConsoleMessage({ type, text, sourceUrl }, firstPartyOrigin) {
  if (!["warning", "error"].includes(type)) return { disposition: "info" };
  let firstParty = false;
  try { firstParty = Boolean(sourceUrl) && new URL(sourceUrl).origin === firstPartyOrigin; } catch { firstParty = false; }
  if (firstParty || !sourceUrl) return { disposition: "defect", label: `first-party console.${type}` };
  const known = KNOWN_EXTERNAL_CONSOLE_DIAGNOSTICS.find((entry) => entry.source.test(sourceUrl) && entry.message.test(text));
  if (known) return { disposition: "external-diagnostic", label: known.label };
  return { disposition: "defect", label: `unexpected external console.${type}` };
}

export function inspectCustomerDocument({ forbiddenSources }, { documentRef = document, getStyle = getComputedStyle } = {}) {
  const patterns = forbiddenSources.map(([label, source, flags]) => [label, new RegExp(source, flags)]);
  const text = documentRef.body.innerText;
  const copyDefects = patterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  const viewportWidth = documentRef.documentElement.clientWidth;
  const headingLimits = viewportWidth <= 360 ? { H1: 36, H2: 32, H3: 28 } : { H1: 40, H2: 36, H3: 32 };
  const headingDefects = [...documentRef.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading],[data-headline=true]")].flatMap((element) => {
    const style = getStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || rect.height <= 0) return [];
    const fontSize = Number.parseFloat(style.fontSize);
    const parsedLineHeight = Number.parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
    const range = documentRef.createRange();
    range.selectNodeContents(element);
    const lineTops = [...range.getClientRects()]
      .filter((lineRect) => lineRect.width > 0 && lineRect.height > 0)
      .map((lineRect) => Math.round(lineRect.top))
      .sort((left, right) => left - right)
      .filter((top, index, values) => index === 0 || Math.abs(top - values[index - 1]) > 2);
    const lineCount = lineTops.length || Math.max(1, Math.round(rect.height / lineHeight));
    const headingText = element.innerText.trim().replace(/\s+/g, " ");
    const wordCount = headingText ? headingText.split(" ").length : 0;
    const found = [];
    const semanticLevel = element.tagName.match(/^H[1-6]$/)?.[0]
      ?? (element.getAttribute("aria-level") ? `H${element.getAttribute("aria-level")}` : "H2");
    const limit = headingLimits[semanticLevel] ?? headingLimits.H3;
    if (fontSize > limit + 0.5) found.push(`${semanticLevel} ${JSON.stringify(headingText)} is ${fontSize}px`);
    if (wordCount <= 6 && headingText.length <= 42 && lineCount > 2) found.push(`${element.tagName} ${JSON.stringify(headingText)} spans ${lineCount} lines`);
    return found;
  });
  const interactiveDefects = [...documentRef.querySelectorAll('button,input:not([type="checkbox"]):not([type="radio"]),select,textarea,[data-primary-action="true"]')]
    .flatMap((element) => {
      const style = getStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.height <= 0) return [];
      return rect.height < 44 || rect.width < 44
        ? [`${element.tagName} interactive target is ${Math.round(rect.width)}x${Math.round(rect.height)}px`]
        : [];
    });
  return {
    copyDefects,
    headingDefects,
    interactiveDefects,
    viewportWidth,
    overflow: documentRef.documentElement.scrollWidth > viewportWidth + 1,
    testimonialCount: documentRef.querySelectorAll('[data-testimonial="true"]').length,
    testimonialTotal: Number(documentRef.querySelector('[data-testimonials="true"]')?.getAttribute("data-testimonials-total") ?? "0"),
    testimonialVisible: Number(documentRef.querySelector('[data-testimonials="true"]')?.getAttribute("data-testimonials-visible") ?? "0"),
    hasTestimonials: Boolean(documentRef.querySelector('[data-testimonials="true"]')),
    hasLoadMoreTestimonials: Boolean(documentRef.querySelector('[data-load-more-testimonials="true"]')),
  };
}

export async function checkCustomerFacingUi(page, location, routePath, defects) {
  if (routePath === "/") {
    const loadMore = page.locator('[data-load-more-testimonials="true"]');
    while (await loadMore.count()) await loadMore.click();
  }
  const result = await page.evaluate(inspectCustomerDocument, {
    forbiddenSources: FORBIDDEN_CUSTOMER_PATTERNS.map(([label, pattern]) => [label, pattern.source, pattern.flags]),
  });

  for (const item of result.copyDefects) defects.push(`${location} contains forbidden customer-facing ${item}`);
  for (const item of result.headingDefects) defects.push(`${location} mobile heading defect: ${item}`);
  for (const item of result.interactiveDefects) defects.push(`${location} mobile interaction defect: ${item}`);
  if (result.overflow) defects.push(`${location} has horizontal overflow at ${result.viewportWidth}px`);
  if (routePath === "/" && (
    !result.hasTestimonials
    || result.testimonialTotal <= 0
    || result.testimonialCount !== result.testimonialTotal
    || result.testimonialVisible !== result.testimonialTotal
    || result.hasLoadMoreTestimonials
  )) {
    defects.push(`${location} must load every testimonial declared by data-testimonials-total`);
  }
}

export function detectedLanIPv4Hosts(interfaces = networkInterfaces()) {
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

export function findServerFailures(output) {
  return SERVER_FAILURE_PATTERNS.flatMap(([label, pattern]) => (pattern.test(output) ? [label] : []));
}

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForOrigin(origin, { timeoutMs = 90_000, fetchImpl = fetch, now = Date.now, delayImpl = delay } = {}) {
  const deadline = now() + timeoutMs;
  let lastError;
  while (now() < deadline) {
    try {
      const response = await fetchImpl(origin, { redirect: "manual" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await delayImpl(250);
  }
  throw new Error(`Dev server did not become ready at ${origin}: ${lastError instanceof Error ? lastError.message : String(lastError ?? "timeout")}`);
}

export async function stopChildProcess(child, { platform = process.platform, spawnImpl = spawn, killImpl = process.kill, delayImpl = delay } = {}) {
  if (!child || child.exitCode !== null) return;
  if (platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawnImpl("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.once("close", resolve);
      killer.once("error", resolve);
    });
    return;
  }

  try {
    killImpl(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  await Promise.race([
    new Promise((resolve) => child.once("close", resolve)),
    delayImpl(5_000).then(() => {
      try { killImpl(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    }),
  ]);
}

export function vendorInitScript() {
  const jsonResponse = (body) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const quote = {
    cart: [{ listing: 1, option: "Default", quantity: 1, name: "Test product" }],
    quote: [{
      was: 1000,
      now: 1000,
      currency: "USD",
      tax: 0,
      lineTotal: 1000,
      lineTax: 0,
      discount: 0,
      listing: 1,
      option: "Default",
      quantity: 1,
      name: "Test product",
    }],
    shippingCost: 0,
    discount: 0,
    currency: "USD",
    tax: 0,
    subtotal: 1000,
    total: 1000,
    id: "runtime-smoke-quote",
    coupon: null,
    shipping: 0,
    shippingCountry: "US",
  };

  Object.defineProperty(window, "niobium", {
    configurable: true,
    value: {
      store: {
        getQuote: async () => jsonResponse(structuredClone(quote)),
        makeOrder: async () => jsonResponse({ instruction: "runtime-smoke-client-secret" }),
        trackOrder: async () => jsonResponse({
          created: new Date(0).toISOString(),
          status: 20,
          cart: [{ listing: 1, option: "Default", quantity: 1, name: "Test product" }],
          shippingStatus: 1,
          shippingCity: "Test City",
          shippingState: null,
          shippingCountry: "US",
        }),
      },
      notification: {
        subscribe: async () => jsonResponse({ success: true }),
        contactUs: async () => jsonResponse({ success: true }),
      },
    },
  });
}

export async function checkHomeNavigation(page, location, routePath, defects) {
  if (routePath === "/") return;

  const homeLink = page.locator('a[data-home-link="true"]').first();
  if ((await homeLink.count()) === 0 || !(await homeLink.isVisible())) {
    defects.push(`${location} has no visible data-home-link back to the home page`);
    return;
  }

  const text = (await homeLink.textContent())?.trim() ?? "";
  if (!/(?:home|shop|product)/i.test(text)) {
    defects.push(`${location} home link does not have obvious visible text`);
  }

  const href = await homeLink.getAttribute("href");
  let destination;
  try {
    destination = new URL(href ?? "", page.url());
  } catch {
    defects.push(`${location} home link has an invalid href`);
    return;
  }
  if (destination.pathname !== "/") {
    defects.push(`${location} home link does not target /`);
    return;
  }

  try {
    await homeLink.click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
  } catch (error) {
    defects.push(`${location} home link could not navigate to /: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function inspectOrigin(browser, origin, defects, { stdout = process.stdout } = {}) {
  const externalDiagnostics = [];
  for (const viewport of MOBILE_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    await context.addInitScript(vendorInitScript);
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === origin) return route.continue();
      const resourceType = route.request().resourceType();
      const contentType = resourceType === "script" ? "application/javascript" : "application/json";
      const body = resourceType === "script"
        ? requestUrl.origin === "https://js.stripe.com" ? STRIPE_FIXTURE_SCRIPT : ""
        : "{}";
      return route.fulfill({ status: 200, contentType, body });
    });

    for (const routePath of REQUIRED_ROUTES) {
      const page = await context.newPage();
      const location = `${origin}${routePath} at ${viewport.width}px`;
      page.on("console", (message) => {
        const sourceUrl = message.location().url ?? "";
        const classification = classifyBrowserConsoleMessage(
          { type: message.type(), text: message.text(), sourceUrl },
          origin,
        );
        if (classification.disposition === "defect") {
          defects.push(`${location} ${classification.label}: ${message.text()} (${sourceUrl || "unknown source"})`);
        } else if (classification.disposition === "external-diagnostic") {
          externalDiagnostics.push(`${location}: ${classification.label}`);
        }
      });
      page.on("pageerror", (error) => defects.push(`${location} pageerror: ${error.message}`));
      page.on("requestfailed", (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === origin) {
          defects.push(`${location} first-party requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
        }
      });

      try {
        const response = await page.goto(`${origin}${routePath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        if (!response || response.status() >= 400) {
          defects.push(`${location} returned HTTP ${response?.status() ?? "no response"}`);
        }
        await page.waitForTimeout(750);
        await checkCustomerFacingUi(page, location, routePath, defects);
        await checkHomeNavigation(page, location, routePath, defects);
      } catch (error) {
        defects.push(`${location} navigation failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
  for (const item of [...new Set(externalDiagnostics)]) stdout.write(`EXTERNAL_DIAGNOSTIC ${item}
`);
}

export async function loadChromium() {
  const { chromium } = await import("@playwright/test");
  return chromium;
}

export async function checkDevRuntime({
  cwd = process.cwd(),
  port = 3000,
  platform = process.platform,
  spawnImpl = spawn,
  waitFor = waitForOrigin,
  chromiumLoader = loadChromium,
  hostDetector = detectedLanIPv4Hosts,
  originInspector = inspectOrigin,
  childStopper = stopChildProcess,
} = {}) {
  const npmCommand = platform === "win32" ? "npm.cmd" : "npm";
  const nodeOptions = [process.env.NODE_OPTIONS, "--unhandled-rejections=strict", "--trace-warnings", "--throw-deprecation"]
    .filter(Boolean)
    .join(" ");
  const child = spawnImpl(npmCommand, ["run", "dev", "--", "--webpack"], {
    cwd,
    detached: platform !== "win32",
    env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: DEV_HOST, PORT: String(port), NODE_OPTIONS: nodeOptions },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk; process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk; process.stderr.write(chunk); });

  const localhostOrigin = `http://localhost:${port}`;
  const origins = [localhostOrigin, ...hostDetector().slice(0, 1).map((host) => `http://${host}:${port}`)];
  const defects = [];
  let browser;
  try {
    await waitFor(localhostOrigin);
    const chromium = await chromiumLoader();
    browser = await chromium.launch({ args: ["--disable-extensions"] });
    for (const origin of origins) await originInspector(browser, origin, defects);
    defects.push(...findServerFailures(serverOutput).map((label) => `dev server emitted ${label}`));
    if (child.exitCode !== null && child.exitCode !== 0) defects.push(`dev server exited early with code ${child.exitCode}`);
    if (defects.length > 0) {
      throw new Error(`Warning-free dev runtime check failed:\n- ${defects.join("\n- ")}\n\nServer output:\n${serverOutput}`);
    }
    return { origins, routes: REQUIRED_ROUTES, viewports: MOBILE_VIEWPORTS, serverOutput };
  } finally {
    await browser?.close();
    await childStopper(child);
  }
}

export function formatDevRuntimeResult(result) {
  return `Warning-free dev runtime passed for ${result.routes.length} routes at ${result.viewports.length} mobile widths across ${result.origins.length} origin(s).\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: checkDevRuntime,
  format: formatDevRuntimeResult,
});
