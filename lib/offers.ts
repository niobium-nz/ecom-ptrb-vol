import offerOptionsJson from "@/config/offer-options.json";

import { createImmediateOfferPrice, type InputDefaultPrice } from "@/lib/offer-pricing";

export type InputCartItem = {
  listing: number;
  option: string;
  quantity: number;
};

export type VendorCartItem = {
  Listing: number;
  Option: string;
  Quantity: number;
};

export type OfferOption = {
  source_offer_key: string;
  offer_option_key: string;
  option_configuration: InputCartItem[];
  recommended: boolean;
  name: string;
  description: string;
  default_price: InputDefaultPrice;
};

export const OFFER_ENV_KEYS = {
  "1": "OFFER_OPTION__1",
  "2": "OFFER_OPTION__2",
  "3": "OFFER_OPTION__3",
} as const;

export const offerOptions = offerOptionsJson as OfferOption[];

export function requireOfferOption(key: string | null | undefined): OfferOption {
  const offer = offerOptions.find((candidate) => candidate.offer_option_key === key);
  if (!offer) {
    throw new Error("We could not identify the selected offer. Please return to the product page and choose an offer again.");
  }
  createImmediateOfferPrice(offer.default_price);
  return offer;
}

export function recommendedOfferOption(): OfferOption {
  const recommended = offerOptions.filter((offer) => offer.recommended);
  if (recommended.length !== 1) throw new Error("The recommended offer configuration is unavailable.");
  return recommended[0];
}

export function toVendorCartItem(item: InputCartItem): VendorCartItem {
  if (
    !Number.isSafeInteger(item.listing) ||
    item.listing <= 0 ||
    typeof item.option !== "string" ||
    !item.option.trim() ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    throw new Error("Offer configuration contains an invalid item.");
  }
  return { Listing: item.listing, Option: item.option, Quantity: item.quantity };
}

export function vendorCartForOffer(offer: OfferOption): VendorCartItem[] {
  if (!Array.isArray(offer.option_configuration) || offer.option_configuration.length === 0) {
    throw new Error(`OFFER_OPTION__${offer.offer_option_key} must contain at least one item.`);
  }
  return offer.option_configuration.map(toVendorCartItem);
}

export function parseVendorCart(raw: unknown, offerKey: string): VendorCartItem[] {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`OFFER_OPTION__${offerKey} is missing.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OFFER_OPTION__${offerKey} must contain valid JSON.`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`OFFER_OPTION__${offerKey} must contain at least one item.`);
  }
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error(`OFFER_OPTION__${offerKey} contains an invalid item.`);
    const candidate = item as Partial<VendorCartItem>;
    if (
      !Number.isSafeInteger(candidate.Listing) ||
      (candidate.Listing as number) <= 0 ||
      typeof candidate.Option !== "string" ||
      !candidate.Option.trim() ||
      !Number.isSafeInteger(candidate.Quantity) ||
      (candidate.Quantity as number) <= 0
    ) {
      throw new Error(`OFFER_OPTION__${offerKey} contains an invalid item.`);
    }
    return {
      Listing: candidate.Listing as number,
      Option: candidate.Option,
      Quantity: candidate.Quantity as number,
    };
  });
}
