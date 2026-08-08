import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestQuote: vi.fn() }));

vi.mock("@/lib/quote", () => ({ requestQuote: mocks.requestQuote }));
vi.mock("@/components/integrations/third-party-scripts", () => ({
  QuoteVendorScript: ({ onError, onReady }: { onError?: () => void; onReady?: () => void }) => (
    <>
      <button onClick={onReady} type="button">Ready quotes</button>
      <button onClick={onError} type="button">Fail quotes</button>
    </>
  ),
}));

import offers from "@/config/offer-options.json";
import { OfferSelector } from "@/components/sections/offer-selector";

afterEach(() => {
  mocks.requestQuote.mockReset();
  delete window.niobium;
  delete window.gtag;
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("OfferSelector branch behavior", () => {
  it("rejects missing and incorrectly keyed recommended options", () => {
    expect(() => render(<OfferSelector offers={offers.map((offer) => ({ ...offer, recommended: false }))} />)).toThrow(
      "Offer option 2",
    );
    expect(() => render(
      <OfferSelector
        offers={offers.map((offer) => ({ ...offer, recommended: offer.offer_option_key === "1" }))}
      />,
    )).toThrow("Offer option 2");
  });

  it("waits for readiness, avoids duplicate quote starts, and retains failures already reported by the script", async () => {
    mocks.requestQuote.mockRejectedValue(new Error("offline"));
    const { rerender } = render(<OfferSelector offers={offers} />);
    expect(mocks.requestQuote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Fail quotes" }));
    fireEvent.click(screen.getByRole("button", { name: "Ready quotes" }));
    await waitFor(() => expect(mocks.requestQuote).toHaveBeenCalledTimes(3));
    expect(screen.getByText("Live price will be confirmed at checkout.")).toBeVisible();

    rerender(<OfferSelector offers={[...offers]} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.requestQuote).toHaveBeenCalledTimes(3);
  });

  it("reveals and hides the sticky action through the observer and disconnects on cleanup", () => {
    const instances: Array<{
      callback: IntersectionObserverCallback;
      disconnect: ReturnType<typeof vi.fn>;
      observe: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeIntersectionObserver {
      callback: IntersectionObserverCallback;
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      root = null;
      rootMargin = "0px";
      thresholds = [0.15];
      takeRecords = () => [];

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        instances.push(this);
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const { container, unmount } = render(<OfferSelector offers={offers} />);
    expect(instances[0].observe).toHaveBeenCalledOnce();
    const sticky = container.querySelector(".sticky-buy");
    act(() => instances[0].callback([{ isIntersecting: false } as IntersectionObserverEntry], instances[0] as never));
    expect(sticky).toHaveAttribute("data-visible", "true");
    expect(sticky?.querySelector("a")).not.toHaveAttribute("tabindex");
    act(() => instances[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], instances[0] as never));
    expect(sticky).toHaveAttribute("data-visible", "false");
    expect(sticky?.querySelector("a")).toHaveAttribute("tabindex", "-1");
    unmount();
    expect(instances[0].disconnect).toHaveBeenCalledOnce();
  });

  it("does not retrack the selected radio and falls back to the recommendation when options change", () => {
    window.gtag = vi.fn();
    const { rerender } = render(<OfferSelector offers={offers} />);
    const recommended = screen.getByRole("radio", { name: /2-Board Home Set/i });
    fireEvent.change(recommended, { target: { checked: true } });
    expect(window.gtag).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Starter Board/i }));
    rerender(<OfferSelector offers={offers.filter((offer) => offer.offer_option_key !== "1")} />);
    expect(screen.getAllByRole("link", { name: "Buy Now" })[0]).toHaveAttribute("href", "/checkout?offer=2");
  });
});
