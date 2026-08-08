export function normalizeCoupon(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function selectCoupon(options: {
  manual?: string | null;
  landing?: string | null;
  fallback?: string | null;
}): string | null {
  return normalizeCoupon(options.manual) ?? normalizeCoupon(options.landing) ?? normalizeCoupon(options.fallback);
}
