export const PRESERVED_QUERY_PARAMS = ["utm_source", "utm_campaign", "utm_content", "fbclid"] as const;

export function preservedQuery(search: string | URLSearchParams, includeCoupon = true): URLSearchParams {
  const source = typeof search === "string" ? new URLSearchParams(search) : search;
  const result = new URLSearchParams();
  for (const key of PRESERVED_QUERY_PARAMS) {
    const value = source.get(key);
    if (value) result.set(key, value);
  }
  if (includeCoupon) {
    const coupon = source.get("coupon");
    if (coupon) result.set("coupon", coupon);
  }
  return result;
}

export function internalUrl(pathname: string, currentSearch: string | URLSearchParams, extra?: Record<string, string>): string {
  const query = preservedQuery(currentSearch);
  for (const [key, value] of Object.entries(extra ?? {})) query.set(key, value);
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
