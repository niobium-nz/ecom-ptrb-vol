import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestQuote: vi.fn(),
  parseVendorCart: vi.fn(() => [{ listing: 1, option: "Default", quantity: 1 }]),
  trackEvent: vi.fn(),
}));

vi.mock("@/components/integrations/third-party-scripts", () => ({
  QuoteVendorScript: ({ onError, onReady }: { onError?: () => void; onReady?: () => void }) => (
    <>
      <button onClick={onReady} type="button">offer quote ready</button>
      <button onClick={onError} type="button">offer quote error</button>
    </>
  ),
}));
vi.mock("@/lib/quote", () => ({ requestQuote: mocks.requestQuote }));
vi.mock("@/lib/offers", () => ({ parseVendorCart: mocks.parseVendorCart }));
vi.mock("@/lib/tracking", () => ({ trackEvent: mocks.trackEvent }));

import offers from "@/config/offer-options.json";
import { OfferSelector } from "@/components/sections/offer-selector";

const quote = {
  cart: [],
  quote: [],
  shippingCost: 0,
  discount: 0,
  currency: "AUD",
  tax: 0,
  subtotal: 3995,
  total: 3995,
  id: "quote",
  coupon: null,
  shipping: 0,
  shippingCountry: "AU",
};

beforeEach(() => {
  vi.clearAllMocks();
  delete window.niobium;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

afterEach(() => {
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

describe("OfferSelector lifecycle", () => {
  it("rejects missing and incorrectly keyed recommendations", () => {
    expect(() => render(<OfferSelector offers={offers.map((item) => ({ ...item, recommended: false }))} />)).toThrow(
      "Offer option 2 must be the recommended home-page offer.",
    );
    expect(() => render(<OfferSelector offers={offers.map((item) => ({
      ...item,
      recommended: item.offer_option_key === "1",
    }))} />)).toThrow("Offer option 2 must be the recommended home-page offer.");
  });

  it("waits for the script, records a script failure, and does not restart quotes", async () => {
    mocks.requestQuote.mockRejectedValue(new Error("offline"));
    const { rerender } = render(<OfferSelector offers={offers} />);
    expect(mocks.requestQuote).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "offer quote error" }));
    await screen.findByText("Live price will be confirmed at checkout.");
    await userEvent.click(screen.getByRole("button", { name: "offer quote ready" }));
    await waitFor(() => expect(mocks.requestQuote).toHaveBeenCalledTimes(3));
    rerender(<OfferSelector offers={[...offers]} />);
    await waitFor(() => expect(mocks.requestQuote).toHaveBeenCalledTimes(3));
  });

  it("does not retrack a change event for the already-selected offer", () => {
    render(<OfferSelector offers={offers} />);
    const recommended = screen.getByRole("radio", { name: /2-Board Home Set/i }) as HTMLInputElement;
    recommended.checked = false;
    fireEvent.click(recommended);
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it("falls back to the recommended offer when a selected option disappears", async () => {
    mocks.requestQuote.mockResolvedValue(quote);
    window.niobium = { store: { getQuote: vi.fn(), makeOrder: vi.fn(), trackOrder: vi.fn() } };
    const { rerender } = render(<OfferSelector offers={offers} />);
    await userEvent.click(screen.getByRole("radio", { name: /Starter Board/i }));
    rerender(<OfferSelector offers={offers.filter((item) => item.offer_option_key !== "1")} />);
    expect(screen.getAllByRole("link", { name: "Buy Now" })[0]).toHaveAttribute("href", "/checkout?offer=2");
  });

  it("observes the primary action, reveals the sticky CTA, and disconnects", async () => {
    let callback!: (entries: Array<{ isIntersecting: boolean }>) => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class Observer {
      constructor(next: typeof callback) { callback = next; }
      observe = observe;
      disconnect = disconnect;
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = Observer;
    const { unmount } = render(<OfferSelector offers={offers} />);
    expect(observe).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
    callback([{ isIntersecting: true }]);
    expect(document.querySelector(".sticky-buy")).toHaveAttribute("data-visible", "false");
    callback([{ isIntersecting: false }]);
    await waitFor(() => expect(document.querySelector(".sticky-buy")).toHaveAttribute("data-visible", "true"));
    expect(screen.getAllByRole("link", { name: "Buy Now" })[1]).not.toHaveAttribute("tabindex");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
