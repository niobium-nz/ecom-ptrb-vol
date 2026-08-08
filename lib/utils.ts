export function isSafeCentAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function requireNonNegativeCents(name: string, value: unknown): number {
  if (!isSafeCentAmount(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer amount in cents`);
  }
  return value;
}

export function centsToMajorUnits(amountCents: number): number {
  if (!isSafeCentAmount(amountCents) || amountCents < 0) {
    throw new Error("amountCents must be a non-negative safe integer amount in cents");
  }
  return amountCents / 100;
}

export function formatMoneyFromCents(
  amountCents: number | null | undefined,
  currency: string | null | undefined,
  locale = "en",
): string {
  if (!isSafeCentAmount(amountCents) || amountCents < 0) return "Price unavailable";

  const normalizedCurrency = currency?.trim().toUpperCase();
  if (!normalizedCurrency || !/^[A-Z]{3}$/.test(normalizedCurrency)) return "Price unavailable";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(centsToMajorUnits(amountCents));
  } catch {
    return "Price unavailable";
  }
}
