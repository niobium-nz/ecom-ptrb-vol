import { describe, expect, it } from "vitest";
import { classifyBrowserConsoleMessage } from "../../scripts/check-dev-runtime.mjs";

const firstPartyOrigin = "http://localhost:3000";

describe("development console classification", () => {
  it("allows only the narrowly identified extension liveness diagnostic from an external source", () => {
    expect(classifyBrowserConsoleMessage({
      type: "warning",
      text: 'ObjectMultiplex - orphaned data for stream "app-init-liveness"',
      sourceUrl: "chrome-extension://example/contentscript.js",
    }, firstPartyOrigin).disposition).toBe("external-diagnostic");
  });

  it("allows the identified reCAPTCHA private-token diagnostic only from Google", () => {
    expect(classifyBrowserConsoleMessage({
      type: "warning",
      text: "Unrecognized feature: 'private-token'.",
      sourceUrl: "https://www.gstatic.com/recaptcha/releases/test/recaptcha__en.js",
    }, firstPartyOrigin).disposition).toBe("external-diagnostic");
  });

  it("fails identical text when it comes from first-party application code", () => {
    expect(classifyBrowserConsoleMessage({
      type: "warning",
      text: "Unrecognized feature: 'private-token'.",
      sourceUrl: `${firstPartyOrigin}/app.js`,
    }, firstPartyOrigin).disposition).toBe("defect");
  });

  it("fails unknown external warnings and warnings without a source", () => {
    expect(classifyBrowserConsoleMessage({ type: "warning", text: "unknown", sourceUrl: "https://example.com/a.js" }, firstPartyOrigin).disposition).toBe("defect");
    expect(classifyBrowserConsoleMessage({ type: "warning", text: "unknown", sourceUrl: "" }, firstPartyOrigin).disposition).toBe("defect");
  });

  it("treats ordinary development information as informational", () => {
    expect(classifyBrowserConsoleMessage({ type: "info", text: "[HMR] connected", sourceUrl: "" }, firstPartyOrigin).disposition).toBe("info");
  });
});
