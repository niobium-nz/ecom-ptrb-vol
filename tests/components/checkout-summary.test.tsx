import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuoteSummary } from "@/components/checkout/checkout-flow";
import type { OfferOption } from "@/lib/offers";
import type { QuoteResponse } from "@/lib/quote";

const offer: OfferOption = {
  source_offer_key: "best_seller_bundle",
  offer_option_key: "2",
  recommended: true,
  name: "2-Board Home Set",
  description: "Two boards",
  default_price: { amount_cents: 3995, currency: "AUD" },
  option_configuration: [{ listing: 1, option: "Default", quantity: 2 }],
};

const quote: QuoteResponse = {
  cart: [{ listing: 1, quantity: 2, name: "PawTrim Reward Board" }],
  quote: [{
    was: 3995,
    now: 3495,
    currency: "AUD",
    tax: 100,
    lineTotal: 3495,
    lineTax: 100,
    discount: 500,
    listing: 1,
    quantity: 2,
    name: "PawTrim Reward Board",
  }],
  shippingCost: 0,
  shippingDescription: "Tracked delivery",
  discount: 500,
  currency: "AUD",
  tax: 100,
  subtotal: 3995,
  total: 3595,
  id: "quote-2",
  coupon: "SAVE",
  shipping: 0,
  shippingCountry: "AU",
};

function renderSummary(overrides: Partial<Parameters<typeof QuoteSummary>[0]["state"]> = {}) {
  const onRetry = vi.fn();
  render(
    <QuoteSummary
      couponDraft="SAVE"
      couponOpen={false}
      offer={offer}
      onCouponDraftChange={vi.fn()}
      onCouponSubmit={vi.fn()}
      onCouponToggle={vi.fn()}
      onRetry={onRetry}
      onStart={vi.fn()}
      state={{ quote, loading: false, error: "", activeCoupon: "SAVE", requestedCoupon: "SAVE", ...overrides }}
    />,
  );
  return onRetry;
}

describe("QuoteSummary", () => {
  it("contains the compact applied coupon and renders cent-formatted live totals", () => {
    renderSummary();
    const summary = screen.getByText("2-Board Home Set").closest("section");
    expect(summary).toHaveAttribute("data-checkout-order-summary", "true");
    expect(within(summary!).getByText("Coupon applied to this order: SAVE")).toHaveAttribute("data-coupon-applied", "true");
    expect(within(summary!).getByText("A$35.95")).toBeVisible();
    expect(within(summary!).getByText("Change coupon")).toHaveAttribute("data-coupon-toggle", "true");
    expect(within(summary!).getByText("Change coupon").closest("div")).toHaveAttribute("data-checkout-coupon", "true");
  });

  it("shows blocking load and retry states without inventing a price", () => {
    const { rerender } = render(
      <QuoteSummary
        couponDraft=""
        couponOpen={false}
        offer={offer}
        onCouponDraftChange={vi.fn()}
        onCouponSubmit={vi.fn()}
        onCouponToggle={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
        state={{ quote: null, loading: true, error: "", activeCoupon: null, requestedCoupon: null }}
      />,
    );
    expect(screen.getByText("Getting your current price...")).toBeVisible();
    expect(screen.queryByText("$39.95")).not.toBeInTheDocument();

    const retry = vi.fn();
    rerender(
      <QuoteSummary
        couponDraft=""
        couponOpen={false}
        offer={offer}
        onCouponDraftChange={vi.fn()}
        onCouponSubmit={vi.fn()}
        onCouponToggle={vi.fn()}
        onRetry={retry}
        onStart={vi.fn()}
        state={{ quote: null, loading: false, error: "We could not refresh the price.", activeCoupon: null, requestedCoupon: null }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("covers the open coupon, fallback labels and zero-adjustment breakdown", () => {
    const start = vi.fn();
    const toggle = vi.fn();
    const change = vi.fn();
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <QuoteSummary
        couponDraft=""
        couponOpen
        offer={offer}
        onCouponDraftChange={change}
        onCouponSubmit={submit}
        onCouponToggle={toggle}
        onRetry={vi.fn()}
        onStart={start}
        state={{
          quote: {
            ...quote,
            discount: 0,
            tax: 0,
            shippingDescription: " ",
            quote: [{ ...quote.quote[0], discount: 0, tax: 0, option: undefined, name: " " }],
          },
          loading: false,
          error: "",
          activeCoupon: null,
          requestedCoupon: null,
        }}
      />,
    );
    expect(screen.getByText(/2-Board Home Set × 2/)).toBeVisible();
    expect(screen.getByText("Tracked delivery")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add or change coupon" }));
    expect(start).toHaveBeenCalled();
    expect(toggle).toHaveBeenCalled();
    fireEvent.focus(screen.getByLabelText("Coupon code"));
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "NEW" } });
    fireEvent.submit(screen.getByLabelText("Coupon code").closest("form")!);
    expect(change).toHaveBeenCalledWith("NEW");
    expect(submit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Apply coupon" })).toBeVisible();
  });

  it("renders a stale live quote and checking coupon state during refresh", () => {
    render(
      <QuoteSummary
        couponDraft="SAVE"
        couponOpen
        offer={offer}
        onCouponDraftChange={vi.fn()}
        onCouponSubmit={vi.fn()}
        onCouponToggle={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
        state={{ quote, loading: true, error: "", activeCoupon: "SAVE", requestedCoupon: "SAVE" }}
      />,
    );
    expect(screen.getByText("A$35.95").closest(".quote-breakdown")).toHaveClass("quote-breakdown--stale");
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();
  });
});
