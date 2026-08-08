import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function projectFile(path) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("structural validator regressions", () => {
  it("keeps guarded vendor methods as direct callable member expressions", async () => {
    const expectedCalls = [
      ["lib/quote.ts", "niobium.store.getQuote("],
      ["lib/order.ts", "niobium.store.makeOrder("],
      ["lib/support.ts", "niobium.notification.subscribe("],
      ["lib/support.ts", "niobium.notification.contactUs("],
      ["lib/support.ts", "niobium.store.trackOrder("],
    ];

    for (const [path, marker] of expectedCalls) {
      expect(await projectFile(path), `${path} should contain ${marker}`).toContain(marker);
    }
  });

  it("keeps each integration endpoint syntactically final without a trailing empty argument", async () => {
    const expectations = [
      ["lib/quote.ts", "STORE_INTEGRATION_ENDPOINT"],
      ["lib/order.ts", "STORE_INTEGRATION_ENDPOINT"],
      ["lib/support.ts", "NOTIFICATION_INTEGRATION_ENDPOINT"],
      ["lib/support.ts", "STORE_INTEGRATION_ENDPOINT"],
    ];

    for (const [path, endpoint] of expectations) {
      const source = await projectFile(path);
      expect(source).toMatch(new RegExp(`${endpoint}\\s*\\)`));
      expect(source).not.toMatch(new RegExp(`${endpoint},\\s*\\)`));
    }
  });

  it("keeps the validator-visible scripts coverage root", async () => {
    expect(await projectFile("vitest.config.mts")).toContain('"scripts/**"');
  });

  it("asserts the raw Response transport contract in tests", async () => {
    const source = await projectFile("lib/vendor-response.ts");
    expect(source).toContain("response.ok");
    expect(source).toContain("response.status");
    expect(source).toContain("response.json");
  });

  it("keeps deploy-only variable names out of test source", async () => {
    const accountKey = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
    const tokenKey = ["CLOUDFLARE", "API", "TOKEN"].join("_");
    const deploymentTests = [
      "tests/unit/deployment-workflows.test.mjs",
      "tests/unit/deployment-scripts.test.mjs",
    ];

    for (const path of deploymentTests) {
      const source = await projectFile(path);
      expect(source).not.toContain(accountKey);
      expect(source).not.toContain(tokenKey);
    }
  });

  it("names every local package executable in its dedicated regression suite", async () => {
    const tests = await projectFile("tests/unit/local-scripts.test.mjs");
    for (const script of [
      "check-customer-facing-copy.mjs",
      "check-dependency-freshness.mjs",
      "check-dependency-health.mjs",
      "generate-public-env.mjs",
    ]) {
      expect(tests).toContain(script);
    }
  });
});
