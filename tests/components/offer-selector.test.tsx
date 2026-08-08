import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import offers from "@/config/offer-options.json";
import { OfferSelector } from "@/components/sections/offer-selector";

function quoteFor(total: number, listing = 1) {
  return {
    cart: [{ listing, option: "Default", quantity: 1, name: "PawTrim Reward Board" }],
    quote: [{
      was: total,
      now: total,
      currency: "AUD",
      tax: 0,
      lineTotal: total,
      lineTax: 0,
      discount: 0,
      listing,
      option: "Default",
      quantity: 1,
      name: "PawTrim Reward Board",
    }],
    shippingCost: 0,
    discount: 0,
    currency: "AUD",
    tax: 0,
    subtotal: total,
    total,
    id: `quote-${total}`,
    coupon: null,
    shipping: 0,
    shippingCountry: "AU",
  };
}

afterEach(() => {
  delete window.niobium;
  delete window.gtag;
  delete window.fbq;
});

describe("OfferSelector", () => {
  it("renders defaults immediately, hydrates each price independently, and tracks selection and CTA clicks", async () => {
    const getQuote = vi.fn((...args: unknown[]) => {
      const cart = args[4] as Array<{ Quantity: number }>;
      const total = cart[0].Quantity === 1 ? 2595 : cart[0].Quantity === 2 ? 4195 : 5695;
      return Promise.resolve(new Response(JSON.stringify(quoteFor(total)), { status: 200 }));
    });
    window.niobium = { store: { getQuote, makeOrder: vi.fn(), trackOrder: vi.fn() } };
    window.gtag = vi.fn();
    window.fbq = vi.fn();
    render(<OfferSelector offers={offers} />);

    const starter = screen.getByText("Starter Board").closest("label");
    expect(starter).not.toBeNull();
    expect(within(starter!).getByText("A$24.95")).toHaveAttribute("data-price-source", "default");

    await waitFor(() => {
      expect(within(starter!).getByText("A$25.95")).toHaveAttribute("data-price-source", "quote");
    });
    expect(getQuote).toHaveBeenCalledTimes(3);
    for (const call of getQuote.mock.calls) {
      expect(typeof call[2]).toBe("number");
      expect(call.at(-1)).toBe("https://staging.api.store.niobium.co.nz");
    }

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /2-Board Home Set/i }));
    expect(window.gtag).not.toHaveBeenCalledWith("event", "OfferSelect", expect.anything());
    await user.click(screen.getByRole("radio", { name: /Starter Board/i }));
    expect(window.gtag).toHaveBeenCalledWith("event", "OfferSelect", { offer_option: "1" });

    const buyNow = screen.getAllByRole("link", { name: "Buy Now" })[0];
    buyNow.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(buyNow);
    expect(window.gtag).toHaveBeenCalledWith("event", "CTAClick", { offer_option: "1" });
  });

  it("keeps the structured default and CTA available when one live quote fails", async () => {
    const getQuote = vi.fn((...args: unknown[]) => {
      const cart = args[4] as Array<{ Quantity: number }>;
      return cart[0].Quantity === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(new Response(JSON.stringify(quoteFor(3995)), { status: 200 }));
    });
    window.niobium = { store: { getQuote, makeOrder: vi.fn(), trackOrder: vi.fn() } };
    render(<OfferSelector offers={offers} />);

    await screen.findByText("Live price will be confirmed at checkout.");
    const starter = screen.getByText("Starter Board").closest("label");
    expect(within(starter!).getByText("A$24.95")).toHaveAttribute("data-price-source", "default");
    expect(screen.getAllByRole("link", { name: "Buy Now" })[0]).toHaveAttribute("href", "/checkout?offer=2");
  });
});
