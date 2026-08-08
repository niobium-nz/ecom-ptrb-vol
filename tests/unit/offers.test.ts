import { describe, expect, it } from "vitest";

import {
  OFFER_ENV_KEYS,
  offerOptions,
  parseVendorCart,
  recommendedOfferOption,
  requireOfferOption,
  toVendorCartItem,
  vendorCartForOffer,
} from "@/lib/offers";

describe("offer configuration", () => {
  it("preserves mapping order, default_price cents, and the explicit environment names", () => {
    expect(offerOptions.map((offer) => offer.offer_option_key)).toEqual(["1", "2", "3"]);
    expect(offerOptions.map((offer) => offer.default_price.amount_cents)).toEqual([2495, 3995, 5495]);
    expect(OFFER_ENV_KEYS).toEqual({
      "1": "OFFER_OPTION__1",
      "2": "OFFER_OPTION__2",
      "3": "OFFER_OPTION__3",
    });
    expect(recommendedOfferOption().offer_option_key).toBe("2");
    expect(requireOfferOption("1").name).toBe("Starter Board");
  });

  it("rejects missing offers and invalid recommended/default configurations", () => {
    expect(() => requireOfferOption("9")).toThrow(/return to the product page/i);
    const recommended = offerOptions.map((offer) => offer.recommended);
    offerOptions.forEach((offer) => { offer.recommended = false; });
    expect(() => recommendedOfferOption()).toThrow(/recommended offer configuration/i);
    offerOptions.forEach((offer, index) => { offer.recommended = recommended[index]; });

    const price = offerOptions[0].default_price.amount_cents;
    offerOptions[0].default_price.amount_cents = 0;
    expect(() => requireOfferOption("1")).toThrow(/greater than zero/i);
    offerOptions[0].default_price.amount_cents = price;
  });

  it("converts lower snake case cart values to vendor wire values", () => {
    expect(toVendorCartItem({ listing: 1, option: "Default", quantity: 2 })).toEqual({
      Listing: 1,
      Option: "Default",
      Quantity: 2,
    });
    expect(vendorCartForOffer(offerOptions[1])).toEqual([
      { Listing: 1, Option: "Default", Quantity: 2 },
      { Listing: 2, Option: "Default", Quantity: 4 },
    ]);
  });

  it.each([
    { listing: 0, option: "Default", quantity: 1 },
    { listing: 1.5, option: "Default", quantity: 1 },
    { listing: 1, option: "", quantity: 1 },
    { listing: 1, option: "Default", quantity: 0 },
    { listing: 1, option: "Default", quantity: 1.5 },
  ])("rejects an invalid input cart item %#", (item) => {
    expect(() => toVendorCartItem(item)).toThrow(/invalid item/i);
  });

  it("rejects an empty input option configuration", () => {
    expect(() => vendorCartForOffer({ ...offerOptions[0], option_configuration: [] })).toThrow(/at least one item/i);
  });

  it("parses a generated vendor cart and rejects invalid expected config", () => {
    expect(parseVendorCart('[{"Listing":1,"Option":"Default","Quantity":1}]', "1")).toEqual([
      { Listing: 1, Option: "Default", Quantity: 1 },
    ]);
    for (const raw of [undefined, "", "not json", "{}", "[]", "[null]", '[{"Listing":0,"Option":"Default","Quantity":1}]', '[{"Listing":1,"Option":"","Quantity":1}]', '[{"Listing":1,"Option":"Default"}]', '[{"Listing":1,"Option":"Default","Quantity":0}]']) {
      expect(() => parseVendorCart(raw, "1")).toThrow(/OFFER_OPTION__1/);
    }
  });
});
