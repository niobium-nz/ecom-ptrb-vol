import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Playwright isolation contract", () => {
  it("removes the inherited color-control conflict before spawning workers", async () => {
    expect(await readFile("playwright.config.ts", "utf8")).toContain(
      "delete process.env.NO_COLOR",
    );
  });

  it("uses the shared gated fixture in every E2E spec", async () => {
    for (const path of [
      "tests/e2e/mobile-customer-ui.spec.ts",
      "tests/e2e/navigation.spec.ts",
    ]) {
      expect(await readFile(path, "utf8")).toContain('from "./storefront-fixture"');
    }
  });

  it("mocks browser integrations without live third-party requests", async () => {
    const source = await readFile("tests/e2e/storefront-fixture.ts", "utf8");
    for (const marker of [
      "addInitScript",
      "window.niobium",
      "js.stripe.com",
      "assets.store.niobium.co.nz",
      "assets.notification.niobium.co.nz",
      'page.on("console"',
      'page.on("pageerror"',
      'page.on("requestfailed"',
    ]) {
      expect(source).toContain(marker);
    }
  });
});
