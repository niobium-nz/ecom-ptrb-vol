import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EXPECTED_INFORMATIONAL_DEV_MESSAGES,
  MOBILE_VIEWPORTS,
  checkCustomerFacingUi,
  checkDevRuntime,
  checkHomeNavigation,
  classifyBrowserConsoleMessage,
  delay,
  detectedLanIPv4Hosts,
  findServerFailures,
  formatDevRuntimeResult,
  inspectCustomerDocument,
  inspectOrigin,
  loadChromium,
  stopChildProcess,
  vendorInitScript,
  waitForOrigin,
} from "../../scripts/check-dev-runtime.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.niobium;
});

describe("runtime diagnostic classification", () => {
  const origin = "http://localhost:3000";

  it("classifies informational, first-party, known external, and unknown console messages", () => {
    expect(EXPECTED_INFORMATIONAL_DEV_MESSAGES.every((pattern) => pattern instanceof RegExp)).toBe(true);
    expect(classifyBrowserConsoleMessage({ type: "log", text: "ordinary", sourceUrl: "" }, origin)).toEqual({ disposition: "info" });
    expect(classifyBrowserConsoleMessage({ type: "error", text: "broken", sourceUrl: `${origin}/app.js` }, origin)).toMatchObject({ disposition: "defect", label: "first-party console.error" });
    expect(classifyBrowserConsoleMessage({ type: "warning", text: "broken", sourceUrl: "not a URL" }, origin)).toMatchObject({ disposition: "defect", label: "unexpected external console.warning" });
    expect(classifyBrowserConsoleMessage({ type: "warning", text: "broken", sourceUrl: "" }, origin)).toMatchObject({ disposition: "defect", label: "first-party console.warning" });
    expect(classifyBrowserConsoleMessage({
      type: "warning",
      text: "MaxListenersExceededWarning: Possible EventEmitter memory leak detected",
      sourceUrl: "contentscript.js",
    }, origin)).toMatchObject({ disposition: "external-diagnostic", label: "browser-extension listener diagnostic" });
    expect(classifyBrowserConsoleMessage({
      type: "warning",
      text: 'ObjectMultiplex - orphaned data for stream "background-liveness"',
      sourceUrl: "moz-extension://extension/contentscript.js",
    }, origin)).toMatchObject({ disposition: "external-diagnostic" });
    expect(classifyBrowserConsoleMessage({
      type: "error",
      text: "unknown",
      sourceUrl: "https://external.example/script.js",
    }, origin)).toMatchObject({ disposition: "defect", label: "unexpected external console.error" });
  });

  it("finds every server failure marker and accepts clean output", () => {
    const output = "⚠ warning npm warn cross-origin request detected allowedDevOrigins outdated version newer version is available could not read source map failed to load source map deprecated DeprEcationWarning unhandled rejection uncaught exception TypeError: broken ReferenceError: broken RangeError: broken SyntaxError: broken hydration failed did not match";
    expect(findServerFailures(output)).toEqual([
      "warning marker",
      "cross-origin warning",
      "outdated dependency notice",
      "source-map failure",
      "deprecation",
      "unhandled failure",
      "runtime exception",
      "hydration failure",
    ]);
    expect(findServerFailures("ready on port 3000")).toEqual([]);
  });
});

function element({
  tagName = "DIV",
  text = "",
  ariaLevel = null,
  rect = { width: 100, height: 50 },
  style = { display: "block", visibility: "visible", fontSize: "16", lineHeight: "20" },
  lines = [],
} = {}) {
  return {
    tagName,
    innerText: text,
    rect,
    style,
    lines,
    getBoundingClientRect: () => rect,
    getAttribute: (name) => name === "aria-level" ? ariaLevel : null,
  };
}

function customerDocument({ width = 320, scrollWidth = 400, text = "— Active coupon", withTestimonials = true } = {}) {
  const headings = [
    element({ tagName: "H1", text: "Short heading", rect: { width: 200, height: 150 }, style: { display: "block", visibility: "visible", fontSize: "50", lineHeight: "normal" }, lines: [
      { width: 0, height: 10, top: 1 },
      { width: 10, height: 10, top: 30 },
      { width: 10, height: 10, top: 10 },
      { width: 10, height: 10, top: 11 },
      { width: 10, height: 10, top: 20 },
    ] }),
    element({ tagName: "DIV", text: "This heading contains more than six words by design", ariaLevel: "7", rect: { width: 200, height: 80 }, style: { display: "block", visibility: "visible", fontSize: "10", lineHeight: "20" } }),
    element({ tagName: "SPAN", text: "", rect: { width: 200, height: 10 }, style: { display: "block", visibility: "visible", fontSize: "10", lineHeight: "20" } }),
    element({ tagName: "H2", style: { display: "none", visibility: "visible", fontSize: "10", lineHeight: "20" } }),
    element({ tagName: "H2", style: { display: "block", visibility: "hidden", fontSize: "10", lineHeight: "20" } }),
    element({ tagName: "H2", rect: { width: 100, height: 0 }, style: { display: "block", visibility: "visible", fontSize: "10", lineHeight: "20" } }),
  ];
  const controls = [
    element({ tagName: "BUTTON", rect: { width: 100, height: 43 } }),
    element({ tagName: "INPUT", rect: { width: 43, height: 50 } }),
    element({ tagName: "SELECT", rect: { width: 50, height: 50 } }),
    element({ tagName: "TEXTAREA", style: { display: "none", visibility: "visible", fontSize: "16", lineHeight: "20" } }),
    element({ tagName: "BUTTON", style: { display: "block", visibility: "hidden", fontSize: "16", lineHeight: "20" } }),
    element({ tagName: "BUTTON", rect: { width: 50, height: 0 } }),
  ];
  const testimonialContainer = withTestimonials
    ? { getAttribute: (name) => name === "data-testimonials-total" ? "2" : "2" }
    : null;
  let selected;
  return {
    body: { innerText: text },
    documentElement: { clientWidth: width, scrollWidth },
    querySelectorAll(selector) {
      if (selector.startsWith("h1")) return headings;
      if (selector === '[data-testimonial="true"]') return withTestimonials ? [{}, {}] : [];
      return controls;
    },
    querySelector(selector) {
      if (selector === '[data-testimonials="true"]') return testimonialContainer;
      if (selector === '[data-load-more-testimonials="true"]') return withTestimonials ? {} : null;
      return null;
    },
    createRange() {
      return {
        selectNodeContents(value) { selected = value; },
        getClientRects() { return selected.lines; },
      };
    },
  };
}

describe("customer document and page checks", () => {
  it("reports copy, responsive heading, interaction, overflow, and testimonial measurements", () => {
    const result = inspectCustomerDocument({
      forbiddenSources: [
        ["dash", "—", ""],
        ["coupon", "active coupon", "i"],
        ["absent", "not present", "i"],
      ],
    }, {
      documentRef: customerDocument(),
      getStyle: (value) => value.style,
    });
    expect(result.copyDefects).toEqual(["dash", "coupon"]);
    expect(result.headingDefects).toEqual(expect.arrayContaining([
      expect.stringContaining("is 50px"),
      expect.stringContaining("spans 3 lines"),
    ]));
    expect(result.interactiveDefects).toHaveLength(2);
    expect(result).toMatchObject({ viewportWidth: 320, overflow: true, testimonialCount: 2, testimonialTotal: 2, testimonialVisible: 2, hasTestimonials: true, hasLoadMoreTestimonials: true });

    const wide = inspectCustomerDocument({ forbiddenSources: [] }, {
      documentRef: customerDocument({ width: 430, scrollWidth: 430, text: "clean", withTestimonials: false }),
      getStyle: (value) => value.style,
    });
    expect(wide).toMatchObject({ viewportWidth: 430, overflow: false, testimonialCount: 0, testimonialTotal: 0, testimonialVisible: 0, hasTestimonials: false, hasLoadMoreTestimonials: false });
  });

  it("loads all home testimonials and appends every page-level defect", async () => {
    const count = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const click = vi.fn().mockResolvedValue(undefined);
    const page = {
      locator: vi.fn().mockReturnValue({ count, click }),
      evaluate: vi.fn().mockResolvedValue({
        copyDefects: ["copy"],
        headingDefects: ["heading"],
        interactiveDefects: ["control"],
        viewportWidth: 320,
        overflow: true,
        testimonialCount: 1,
        testimonialTotal: 2,
        testimonialVisible: 1,
        hasTestimonials: false,
        hasLoadMoreTestimonials: true,
      }),
    };
    const defects = [];
    await checkCustomerFacingUi(page, "home", "/", defects);
    expect(click).toHaveBeenCalledOnce();
    expect(defects).toHaveLength(5);

    const cleanPage = {
      locator: vi.fn(),
      evaluate: vi.fn().mockResolvedValue({
        copyDefects: [], headingDefects: [], interactiveDefects: [], viewportWidth: 430, overflow: false,
        testimonialCount: 0, testimonialTotal: 0, testimonialVisible: 0, hasTestimonials: false, hasLoadMoreTestimonials: false,
      }),
    };
    const cleanDefects = [];
    await checkCustomerFacingUi(cleanPage, "contact", "/contact", cleanDefects);
    expect(cleanDefects).toEqual([]);
    expect(cleanPage.locator).not.toHaveBeenCalled();
  });
});

describe("network discovery and readiness", () => {
  it("selects only external IPv4 interfaces", () => {
    expect(detectedLanIPv4Hosts({
      empty: null,
      loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
      ipv6: [{ family: "IPv6", internal: false, address: "::1" }],
      lan: [{ family: "IPv4", internal: false, address: "192.0.2.5" }],
    })).toEqual(["192.0.2.5"]);
    expect(Array.isArray(detectedLanIPv4Hosts())).toBe(true);
  });

  it("waits through server errors and network rejection until ready", async () => {
    let time = 0;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ status: 500 })
      .mockRejectedValueOnce(new Error("starting"))
      .mockResolvedValueOnce({ status: 404 });
    await expect(waitForOrigin("http://localhost", {
      timeoutMs: 5,
      fetchImpl,
      now: () => time,
      delayImpl: async () => { time += 1; },
    })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
    await expect(waitForOrigin("http://localhost")).resolves.toBeUndefined();
    await delay(0);
  });

  it("reports Error, non-Error, and no-error timeout details", async () => {
    for (const failure of [new Error("network down"), "plain failure", null]) {
      let time = 0;
      const fetchImpl = failure === null
        ? vi.fn().mockResolvedValue({ status: 500 })
        : vi.fn().mockRejectedValue(failure);
      await expect(waitForOrigin("http://localhost", {
        timeoutMs: 1,
        fetchImpl,
        now: () => time,
        delayImpl: async () => { time += 1; },
      })).rejects.toThrow(failure instanceof Error ? "network down" : failure === null ? "timeout" : "plain failure");
    }
  });
});

function eventChild({ exitCode = null, pid = 321 } = {}) {
  const child = new EventEmitter();
  child.exitCode = exitCode;
  child.pid = pid;
  child.kill = vi.fn();
  return child;
}

describe("dev child shutdown", () => {
  it("returns for absent and already exited processes", async () => {
    await expect(stopChildProcess(null)).resolves.toBeUndefined();
    await expect(stopChildProcess(eventChild({ exitCode: 0 }))).resolves.toBeUndefined();
  });

  it("uses taskkill on Windows for close and launch-error outcomes", async () => {
    for (const event of ["close", "error"]) {
      const killer = new EventEmitter();
      const spawnImpl = vi.fn().mockReturnValue(killer);
      const promise = stopChildProcess(eventChild(), { platform: "win32", spawnImpl });
      queueMicrotask(() => killer.emit(event, event === "error" ? new Error("ignored") : 0));
      await promise;
      expect(spawnImpl).toHaveBeenCalledWith("taskkill", ["/pid", "321", "/T", "/F"], { stdio: "ignore" });
    }
  });

  it("terminates Unix process groups and falls back to child kill", async () => {
    const graceful = eventChild();
    const gracefulKill = vi.fn();
    const gracefulPromise = stopChildProcess(graceful, {
      platform: "linux",
      killImpl: gracefulKill,
      delayImpl: () => new Promise(() => {}),
    });
    queueMicrotask(() => graceful.emit("close", 0));
    await gracefulPromise;
    expect(gracefulKill).toHaveBeenCalledWith(-321, "SIGTERM");

    const fallback = eventChild();
    const fallbackPromise = stopChildProcess(fallback, {
      platform: "linux",
      killImpl: vi.fn(() => { throw new Error("no group"); }),
      delayImpl: () => new Promise(() => {}),
    });
    queueMicrotask(() => fallback.emit("close", 0));
    await fallbackPromise;
    expect(fallback.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("force-kills the process group or child after the grace timeout", async () => {
    const group = eventChild();
    const groupKill = vi.fn();
    await stopChildProcess(group, { platform: "linux", killImpl: groupKill, delayImpl: vi.fn().mockResolvedValue(undefined) });
    expect(groupKill).toHaveBeenNthCalledWith(2, -321, "SIGKILL");

    const child = eventChild();
    let calls = 0;
    await stopChildProcess(child, {
      platform: "linux",
      killImpl: vi.fn(() => { calls += 1; if (calls === 2) throw new Error("no group"); }),
      delayImpl: vi.fn().mockResolvedValue(undefined),
    });
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
});

describe("vendor runtime fixture", () => {
  it("installs raw Response returning store and notification methods", async () => {
    vendorInitScript();
    expect(window.niobium).toBeDefined();
    const quoteResponse = await window.niobium.store.getQuote();
    expect(quoteResponse).toBeInstanceOf(Response);
    await expect(quoteResponse.json()).resolves.toMatchObject({ total: 1000, shippingCountry: "US" });
    await expect((await window.niobium.store.makeOrder()).json()).resolves.toEqual({ instruction: "runtime-smoke-client-secret" });
    await expect((await window.niobium.store.trackOrder()).json()).resolves.toMatchObject({ status: 20, shippingState: null });
    await expect((await window.niobium.notification.subscribe()).json()).resolves.toEqual({ success: true });
    await expect((await window.niobium.notification.contactUs()).json()).resolves.toEqual({ success: true });
  });
});

function homePage(overrides = {}) {
  const link = {
    count: vi.fn().mockResolvedValue(1),
    isVisible: vi.fn().mockResolvedValue(true),
    textContent: vi.fn().mockResolvedValue("Back to home"),
    getAttribute: vi.fn().mockResolvedValue("/"),
    click: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    link,
    page: {
      locator: vi.fn().mockReturnValue({ first: () => link }),
      url: vi.fn().mockReturnValue("http://localhost:3000/contact"),
      waitForURL: vi.fn(async (predicate) => { expect(predicate(new URL("http://localhost:3000/"))).toBe(true); }),
    },
  };
}

describe("return-home runtime navigation", () => {
  it("skips home and accepts a visible obvious link that reaches root", async () => {
    const defects = [];
    await checkHomeNavigation({}, "home", "/", defects);
    const { page, link } = homePage();
    await checkHomeNavigation(page, "contact", "/contact", defects);
    expect(defects).toEqual([]);
    expect(link.click).toHaveBeenCalledOnce();
  });

  it("reports absent, hidden, unclear, malformed, and wrong-destination links", async () => {
    for (const [overrides, expected] of [
      [{ count: vi.fn().mockResolvedValue(0) }, "no visible"],
      [{ isVisible: vi.fn().mockResolvedValue(false) }, "no visible"],
      [{ textContent: vi.fn().mockResolvedValue(null) }, "obvious visible text"],
      [{ getAttribute: vi.fn().mockResolvedValue(null) }, "does not target"],
      [{ textContent: vi.fn().mockResolvedValue("Return"), getAttribute: vi.fn().mockResolvedValue("http://[") }, "invalid href"],
      [{ getAttribute: vi.fn().mockResolvedValue("/contact") }, "does not target"],
    ]) {
      const { page } = homePage(overrides);
      const defects = [];
      await checkHomeNavigation(page, "page", "/contact", defects);
      expect(defects.join(" ")).toContain(expected);
    }
  });

  it("reports Error and non-Error click failures", async () => {
    for (const failure of [new Error("click failed"), "plain click failure"]) {
      const { page } = homePage({ click: vi.fn().mockRejectedValue(failure) });
      const defects = [];
      await checkHomeNavigation(page, "page", "/contact", defects);
      expect(defects[0]).toContain(failure instanceof Error ? failure.message : failure);
    }
  });
});

function runtimeBrowserFixture(origin) {
  let pageNumber = 0;
  const context = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
    route: vi.fn(async (_pattern, handler) => {
      const routes = [
        { url: `${origin}/app.js`, type: "script", expected: "continue" },
        { url: "https://external.example/script.js", type: "script", expected: "fulfill" },
        { url: "https://js.stripe.com/dahlia/stripe.js", type: "script", expected: "fulfill", bodyIncludes: "window.Stripe" },
        { url: "https://external.example/image.png", type: "image", expected: "fulfill" },
      ];
      for (const item of routes) {
        const route = {
          request: () => ({ url: () => item.url, resourceType: () => item.type }),
          continue: vi.fn().mockResolvedValue(undefined),
          fulfill: vi.fn().mockResolvedValue(undefined),
        };
        await handler(route);
        expect(route[item.expected]).toHaveBeenCalledOnce();
        if (item.bodyIncludes) {
          expect(route.fulfill).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.stringContaining(item.bodyIncludes),
          }));
        }
      }
    }),
    newPage: vi.fn(async () => {
      const handlers = {};
      const current = pageNumber;
      pageNumber += 1;
      let currentUrl = `${origin}/`;
      const link = {
        count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true),
        textContent: vi.fn().mockResolvedValue("Home"), getAttribute: vi.fn().mockResolvedValue("/"), click: vi.fn().mockResolvedValue(undefined),
      };
      return {
        on: (name, handler) => { handlers[name] = handler; },
        locator: (selector) => selector.includes("load-more")
          ? { count: vi.fn().mockResolvedValue(0), click: vi.fn() }
          : { first: () => link },
        evaluate: vi.fn().mockResolvedValue({
          copyDefects: [], headingDefects: [], interactiveDefects: [], viewportWidth: 320, overflow: false,
          testimonialCount: 2, testimonialTotal: 2, testimonialVisible: 2, hasTestimonials: true, hasLoadMoreTestimonials: false,
        }),
        goto: vi.fn(async (url) => {
          currentUrl = url;
          handlers.console({ type: () => "info", text: () => "connected", location: () => ({ url: undefined }) });
          if (current === 0) handlers.console({ type: () => "warning", text: () => "unknown source warning", location: () => ({ url: undefined }) });
          handlers.console({ type: () => "warning", text: () => 'ObjectMultiplex - orphaned data for stream "app-init-liveness"', location: () => ({ url: "chrome-extension://extension/contentscript.js" }) });
          if (current === 0) handlers.console({ type: () => "warning", text: () => "unknown", location: () => ({ url: "https://external.example/script.js" }) });
          if (current === 0) handlers.pageerror(new Error("page failure"));
          if (current === 0) {
            handlers.requestfailed({ url: () => `${origin}/failed`, failure: () => ({ errorText: "reset" }) });
            handlers.requestfailed({ url: () => `${origin}/unknown`, failure: () => null });
            handlers.requestfailed({ url: () => "https://external.example/ignored", failure: () => ({ errorText: "ignored" }) });
          }
          if (current === 0) return null;
          if (current === 1) return { status: () => 404 };
          if (current === 2) throw new Error("navigation error");
          if (current === 3) throw "plain navigation error";
          return { status: () => 200 };
        }),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        url: () => currentUrl,
        waitForURL: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    browser: { newContext: vi.fn().mockResolvedValue(context) },
    context,
  };
}

describe("origin inspection", () => {
  it("checks every route at every mobile viewport and records browser defects", async () => {
    const origin = "http://localhost:3000";
    const { browser, context } = runtimeBrowserFixture(origin);
    const defects = [];
    const stdout = { write: vi.fn() };
    await inspectOrigin(browser, origin, defects, { stdout });
    expect(browser.newContext).toHaveBeenCalledTimes(MOBILE_VIEWPORTS.length);
    expect(context.newPage).toHaveBeenCalledTimes(MOBILE_VIEWPORTS.length * 9);
    expect(context.close).toHaveBeenCalledTimes(MOBILE_VIEWPORTS.length);
    expect(defects.join("\n")).toMatch(/unexpected external console.warning[\s\S]*pageerror[\s\S]*requestfailed[\s\S]*no response[\s\S]*HTTP 404[\s\S]*navigation failed/);
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("EXTERNAL_DIAGNOSTIC"));
  });
});

function runtimeChild(exitCode = null) {
  const child = eventChild({ exitCode });
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = vi.fn();
  child.stderr.setEncoding = vi.fn();
  return child;
}

describe("runtime orchestration", () => {
  it("runs local and one LAN origin and returns the full route/viewport result", async () => {
    const child = runtimeChild();
    const spawnImpl = vi.fn().mockReturnValue(child);
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    const chromium = { launch: vi.fn().mockResolvedValue(browser) };
    const originInspector = vi.fn().mockResolvedValue(undefined);
    const childStopper = vi.fn().mockResolvedValue(undefined);
    const resultPromise = checkDevRuntime({
      cwd: ".", port: 3456, platform: "win32", spawnImpl,
      waitFor: async () => { child.stdout.emit("data", "ready\n"); child.stderr.emit("data", "note\n"); },
      chromiumLoader: vi.fn().mockResolvedValue(chromium),
      hostDetector: () => ["192.0.2.10", "192.0.2.11"],
      originInspector,
      childStopper,
    });
    const result = await resultPromise;
    expect(spawnImpl).toHaveBeenCalledWith(
      "npm.cmd",
      ["run", "dev", "--", "--webpack"],
      expect.objectContaining({ detached: false }),
    );
    expect(result.origins).toEqual(["http://localhost:3456", "http://192.0.2.10:3456"]);
    expect(result.serverOutput).toBe("ready\nnote\n");
    expect(originInspector).toHaveBeenCalledTimes(2);
    expect(browser.close).toHaveBeenCalledOnce();
    expect(childStopper).toHaveBeenCalledWith(child);
    expect(formatDevRuntimeResult(result)).toContain("9 routes at 4 mobile widths across 2 origin(s)");
  });

  it("fails on inspector defects, unhealthy server output, and an early nonzero exit", async () => {
    const child = runtimeChild(2);
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    await expect(checkDevRuntime({
      spawnImpl: vi.fn().mockReturnValue(child),
      waitFor: async () => { child.stdout.emit("data", "warning: broken\n"); },
      chromiumLoader: vi.fn().mockResolvedValue({ launch: vi.fn().mockResolvedValue(browser) }),
      hostDetector: () => [],
      originInspector: vi.fn(async (_browser, _origin, defects) => { defects.push("browser defect"); }),
      childStopper: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow(/browser defect[\s\S]*warning marker[\s\S]*exited early/);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("still stops the child when readiness fails before browser launch", async () => {
    const child = runtimeChild(0);
    const childStopper = vi.fn().mockResolvedValue(undefined);
    await expect(checkDevRuntime({
      platform: "linux",
      spawnImpl: vi.fn().mockReturnValue(child),
      waitFor: vi.fn().mockRejectedValue("not ready"),
      chromiumLoader: vi.fn(),
      hostDetector: () => [],
      originInspector: vi.fn(),
      childStopper,
    })).rejects.toBe("not ready");
    expect(childStopper).toHaveBeenCalledWith(child);
  });

  it("loads Playwright Chromium through the canonical package", async () => {
    await expect(loadChromium()).resolves.toHaveProperty("launch");
  });
});
