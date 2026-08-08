export const SUPPORTED_COUNTRIES = ["US", "UK", "CA", "AU", "SG", "NZ", "IE"] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export type CheckoutFieldConfig = {
  cityLabel: string;
  postcodeLabel: string;
  postcodeRequired: boolean;
  stateLabel?: string;
  stateRequired: boolean;
  suburbLabel?: string;
};

const FIELD_CONFIG: Record<SupportedCountry, CheckoutFieldConfig> = {
  US: { cityLabel: "City", postcodeLabel: "ZIP code", postcodeRequired: true, stateLabel: "State", stateRequired: true },
  UK: { cityLabel: "Town or city", postcodeLabel: "Postcode", postcodeRequired: true, stateRequired: false },
  CA: { cityLabel: "City", postcodeLabel: "Postal code", postcodeRequired: true, stateLabel: "Province or territory", stateRequired: true },
  AU: { cityLabel: "Suburb", postcodeLabel: "Postcode", postcodeRequired: true, stateLabel: "State/Territory", stateRequired: true },
  SG: { cityLabel: "City", postcodeLabel: "Postal code", postcodeRequired: true, stateRequired: false },
  NZ: { cityLabel: "Town/City", postcodeLabel: "Postcode", postcodeRequired: true, stateRequired: false, suburbLabel: "Suburb" },
  IE: { cityLabel: "Town/City", postcodeLabel: "Eircode (optional)", postcodeRequired: false, stateLabel: "County (optional)", stateRequired: false },
};

export function isSupportedCountry(value: string): value is SupportedCountry {
  return SUPPORTED_COUNTRIES.includes(value as SupportedCountry);
}

export function checkoutFieldConfig(country: string): CheckoutFieldConfig {
  if (!isSupportedCountry(country)) throw new Error("Checkout is not configured for this delivery country.");
  return FIELD_CONFIG[country];
}

export function validPostcode(country: SupportedCountry, value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (country === "IE" && !normalized) return true;
  if (country === "US") return /^\d{5}(?:-\d{4})?$/.test(normalized);
  if (country === "CA") return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(normalized);
  if (country === "AU" || country === "NZ") return /^\d{4}$/.test(normalized);
  if (country === "SG") return /^\d{6}$/.test(normalized);
  if (country === "IE") return /^[A-Z0-9]{3}\s?[A-Z0-9]{4}$/.test(normalized);
  return normalized.length >= 3;
}

export function normalizePostcode(country: SupportedCountry, value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (country === "CA" && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
  }
  if (country === "IE" && /^[A-Z0-9]{7}$/.test(normalized)) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
  }
  return normalized;
}
