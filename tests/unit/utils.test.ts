import { describe, expect, it } from "vitest";

import {
  centsToMajorUnits,
  formatMoneyFromCents,
  isSafeCentAmount,
  requireNonNegativeCents,
} from "@/lib/utils";

describe("cent-based money helpers", () => {
  it("recognizes safe integer cent values only", () => {
    expect(isSafeCentAmount(0)).toBe(true);
    expect(isSafeCentAmount(2495)).toBe(true);
    expect(isSafeCentAmount("2495")).toBe(false);
    expect(isSafeCentAmount(1.5)).toBe(false);
    expect(isSafeCentAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it("formats cents as major currency units", () => {
    expect(formatMoneyFromCents(2495, "AUD", "en-AU")).toContain("24.95");
    expect(formatMoneyFromCents(0, "AUD", "en-AU")).toContain("0.00");
  });

  it.each([undefined, null, -1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "returns a pending marker for invalid amount %s",
    (value) => {
      expect(formatMoneyFromCents(value, "AUD")).toBe("Price unavailable");
    },
  );

  it.each([undefined, null, "", "A", "AUDD", "12$"])(
    "returns a pending marker for invalid currency %s",
    (currency) => {
      expect(formatMoneyFromCents(2495, currency)).toBe("Price unavailable");
    },
  );

  it("normalizes lowercase and surrounding currency whitespace", () => {
    expect(formatMoneyFromCents(2495, " aud ", "en-AU")).toContain("24.95");
  });

  it("returns the pending marker when Intl rejects the locale", () => {
    expect(formatMoneyFromCents(2495, "AUD", "not_a_locale")).toBe("Price unavailable");
  });

  it("converts cents without rounding", () => {
    expect(centsToMajorUnits(1)).toBe(0.01);
    expect(centsToMajorUnits(2495)).toBe(24.95);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid cents in centsToMajorUnits: %s",
    (value) => {
      expect(() => centsToMajorUnits(value)).toThrow();
    },
  );

  it("accepts zero and rejects non-integer or negative cents at a strict boundary", () => {
    expect(requireNonNegativeCents("total", 0)).toBe(0);
    expect(() => requireNonNegativeCents("total", "1")).toThrow();
    expect(() => requireNonNegativeCents("total", 1.5)).toThrow();
    expect(() => requireNonNegativeCents("total", -1)).toThrow();
  });
});
