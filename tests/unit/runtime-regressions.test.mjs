import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("warning-free runtime regressions", () => {
  it("declares smooth scrolling on the document root for Next runtime diagnostics", async () => {
    const source = await readFile("app/layout.tsx", "utf8");
    expect(source).toContain('data-scroll-behavior="smooth"');
  });

  it("provides a functional deterministic Stripe.js runtime fixture", async () => {
    const runtime = await import("../../scripts/check-dev-runtime.mjs");
    expect(runtime.STRIPE_FIXTURE_SCRIPT).toBeTypeOf("string");

    window.eval(runtime.STRIPE_FIXTURE_SCRIPT);
    expect(window.Stripe.version).toBe("dahlia");
    const stripe = window.Stripe("pk_test_runtime");
    expect(stripe).toEqual(expect.objectContaining({
      _registerWrapper: expect.any(Function),
      registerAppInfo: expect.any(Function),
      elements: expect.any(Function),
      createToken: expect.any(Function),
      createPaymentMethod: expect.any(Function),
      confirmCardPayment: expect.any(Function),
      confirmPayment: expect.any(Function),
    }));

    const elements = stripe.elements();
    expect(elements).toEqual(expect.objectContaining({
      create: expect.any(Function),
      submit: expect.any(Function),
      update: expect.any(Function),
    }));
    const payment = elements.create("payment");
    expect(payment).toEqual(expect.objectContaining({
      on: expect.any(Function),
      off: expect.any(Function),
      mount: expect.any(Function),
      destroy: expect.any(Function),
      update: expect.any(Function),
      collapse: expect.any(Function),
    }));

    const runtimeSource = await readFile("scripts/check-dev-runtime.mjs", "utf8");
    expect(runtimeSource).toMatch(/js\.stripe\.com[\s\S]*STRIPE_FIXTURE_SCRIPT|STRIPE_FIXTURE_SCRIPT[\s\S]*js\.stripe\.com/);
  });

  it("uses the supported webpack dev path and disables Next agent-file mutation", async () => {
    const runtimeSource = await readFile("scripts/check-dev-runtime.mjs", "utf8");
    const nextConfig = await readFile("next.config.mjs", "utf8");
    expect(runtimeSource).toContain('"--webpack"');
    expect(nextConfig).toContain("agentRules: false");
  });
});
