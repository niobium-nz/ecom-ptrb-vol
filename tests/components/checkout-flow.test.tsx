import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { value: "offer=2" },
  stripe: { current: null as null | { confirmPayment: ReturnType<typeof vi.fn> } },
  elements: { current: null as null | { submit: ReturnType<typeof vi.fn> } },
  requestQuote: vi.fn(),
  requestOrder: vi.fn(),
  buildOrderPayload: vi.fn(),
  checkoutEventPayload: vi.fn(() => ({ safe: true })),
  trackEvent: vi.fn(),
  validPostcode: vi.fn(() => true),
  requireOfferOption: vi.fn(),
  parseVendorCart: vi.fn(),
  selectCoupon: vi.fn(({ manual, landing, fallback }: Record<string, string | null>) =>
    manual?.trim() || landing?.trim() || fallback?.trim() || null
  ),
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search.value),
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: mocks.loadStripe }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="elements">{children}</div>,
  PaymentElement: ({ onChange, onReady }: { onChange: () => void; onReady: () => void }) => (
    <div data-testid="payment-element" onClick={onChange} onFocus={onReady} role="button" tabIndex={0} />
  ),
  useElements: () => mocks.elements.current,
  useStripe: () => mocks.stripe.current,
}));
vi.mock("@/components/integrations/third-party-scripts", () => ({
  QuoteVendorScript: ({ onError, onReady }: { onError?: () => void; onReady?: () => void }) => (
    <div>
      <button onClick={onReady} type="button">quote ready</button>
      <button onClick={onError} type="button">quote script error</button>
    </div>
  ),
  OrderVendorScript: () => <span>order script</span>,
}));
vi.mock("@/lib/checkout-fields", () => ({
  checkoutFieldConfig: () => ({ cityLabel: "Suburb", stateLabel: "State/Territory", postcodeLabel: "Postcode" }),
  normalizePostcode: (_country: string, value: string) => value.trim(),
  validPostcode: mocks.validPostcode,
}));
vi.mock("@/lib/coupon", () => ({ selectCoupon: mocks.selectCoupon }));
vi.mock("@/lib/offers", () => ({
  requireOfferOption: mocks.requireOfferOption,
  parseVendorCart: mocks.parseVendorCart,
}));
vi.mock("@/lib/order", () => ({
  buildOrderPayload: mocks.buildOrderPayload,
  requestOrder: mocks.requestOrder,
}));
vi.mock("@/lib/quote", () => ({ requestQuote: mocks.requestQuote }));
vi.mock("@/lib/tracking", () => ({
  checkoutEventPayload: mocks.checkoutEventPayload,
  trackEvent: mocks.trackEvent,
}));

import {
  CheckoutFlow,
  CheckoutPaymentForm,
  customerMessage,
  inputValue,
  resolveOffer,
} from "@/components/checkout/checkout-flow";

const offer = {
  source_offer_key: "best_seller_bundle",
  offer_option_key: "2",
  recommended: true,
  name: "2-Board Home Set",
  description: "Two boards",
  default_price: { amount_cents: 3995, currency: "AUD" },
  option_configuration: [{ listing: 1, option: "Default", quantity: 2 }],
};
const cart = [{ Listing: 1, Option: "Default", Quantity: 2 }];
const quote = {
  cart: [{ listing: 1, option: "Default", quantity: 2 }],
  quote: [{
    was: 3995,
    now: 3995,
    currency: "AUD",
    tax: 0,
    lineTotal: 3995,
    lineTax: 0,
    discount: 0,
    listing: 1,
    option: "Default",
    quantity: 2,
    name: "PawTrim Reward Board",
  }],
  shippingCost: 0,
  shippingDescription: "Tracked delivery",
  discount: 0,
  currency: "AUD",
  tax: 0,
  subtotal: 3995,
  total: 3995,
  id: "quote-2",
  coupon: null,
  shipping: 0,
  shippingCountry: "AU",
};

beforeEach(() => {
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockReset" in value) value.mockReset();
  }
  mocks.search.value = "offer=2";
  mocks.stripe.current = { confirmPayment: vi.fn().mockResolvedValue({}) };
  mocks.elements.current = { submit: vi.fn().mockResolvedValue({}) };
  mocks.validPostcode.mockReturnValue(true);
  mocks.requireOfferOption.mockImplementation((key: string | null) => {
    if (key !== "2") throw new Error("Choose a valid offer.");
    return offer;
  });
  mocks.parseVendorCart.mockReturnValue(cart);
  mocks.selectCoupon.mockImplementation(({ manual, landing, fallback }: Record<string, string | null>) =>
    manual?.trim() || landing?.trim() || fallback?.trim() || null
  );
  mocks.buildOrderPayload.mockReturnValue({ order: true });
  mocks.requestOrder.mockResolvedValue({ instruction: "client-secret" });
  mocks.checkoutEventPayload.mockReturnValue({ safe: true });
  window.niobium = { store: { getQuote: vi.fn(), makeOrder: vi.fn(), trackOrder: vi.fn() } };
});

describe("checkout helpers", () => {
  it("selects safe customer messages for all error shapes", () => {
    expect(customerMessage(new Error("Safe message"), "Fallback")).toBe("Safe message");
    expect(customerMessage(new Error("   "), "Fallback")).toBe("Fallback");
    expect(customerMessage("bad", "Fallback")).toBe("Fallback");
  });

  it("resolves the requested offer and cart and exposes missing form controls as empty", () => {
    expect(resolveOffer("2")).toEqual({ offer, cart });
    expect(mocks.requireOfferOption).toHaveBeenCalledWith("2");
    const data = new FormData();
    data.set("present", "value");
    expect(inputValue(data, "present")).toBe("value");
    expect(inputValue(data, "missing")).toBe("");
  });
});

function renderPayment(paymentBlocked = false) {
  const onStart = vi.fn();
  const view = render(
    <CheckoutPaymentForm
      cart={cart}
      coupon="SAVE"
      offerKey="2"
      onStart={onStart}
      paymentBlocked={paymentBlocked}
      quote={quote}
    />,
  );
  return { ...view, onStart };
}

function paymentForm() {
  return screen.getByRole("button", { name: /Pay securely|Refresh price to continue/ }).closest("form")!;
}

function setPostcode(value = "2000") {
  fireEvent.change(screen.getByRole("textbox", { name: /Postcode.*Required/ }), { target: { value } });
}

describe("CheckoutPaymentForm", () => {
  it("renders optional billing fields and marks payment interactions", () => {
    const { onStart } = renderPayment();
    expect(screen.getByRole("button", { name: "Pay securely" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Billing address is the same/ }));
    expect(screen.getByRole("group", { name: "Billing address" })).toBeVisible();
    fireEvent.focus(screen.getByTestId("payment-element"));
    expect(screen.getByRole("button", { name: "Pay securely" })).toBeEnabled();
    fireEvent.click(screen.getByTestId("payment-element"));
    expect(onStart).toHaveBeenCalled();
  });

  it("blocks submission for every unavailable prerequisite", () => {
    const { rerender } = renderPayment(true);
    fireEvent.submit(paymentForm());
    expect(mocks.elements.current!.submit).not.toHaveBeenCalled();

    rerender(<CheckoutPaymentForm cart={cart} coupon={null} offerKey="2" onStart={vi.fn()} paymentBlocked={false} quote={quote} />);
    mocks.stripe.current = null;
    rerender(<CheckoutPaymentForm cart={cart} coupon={null} offerKey="2" onStart={vi.fn()} paymentBlocked={false} quote={quote} />);
    fireEvent.submit(paymentForm());
    mocks.stripe.current = { confirmPayment: vi.fn() };
    mocks.elements.current = null;
    rerender(<CheckoutPaymentForm cart={cart} coupon={null} offerKey="2" onStart={vi.fn()} paymentBlocked={false} quote={quote} />);
    fireEvent.submit(paymentForm());
    expect(mocks.requestOrder).not.toHaveBeenCalled();
  });

  it("rejects an invalid postcode", () => {
    mocks.validPostcode.mockReturnValue(false);
    renderPayment();
    setPostcode("12");
    fireEvent.submit(paymentForm());
    expect(screen.getByText("Enter a valid 4-digit Australian postcode.")).toBeVisible();
  });

  it.each([
    ["Card details need attention", "Card details need attention"],
    ["", "Check your payment details and try again."],
  ])("shows Stripe element validation errors", async (message, expected) => {
    mocks.elements.current!.submit.mockResolvedValueOnce({ error: { message } });
    renderPayment();
    setPostcode();
    fireEvent.submit(paymentForm());
    expect(await screen.findByText(expected)).toBeVisible();
  });

  it.each([
    ["Payment declined", "Payment declined"],
    ["", "We could not confirm your payment. Please try again."],
  ])("shows payment confirmation failures", async (message, expected) => {
    mocks.stripe.current!.confirmPayment.mockResolvedValueOnce({ error: { message } });
    renderPayment();
    setPostcode();
    fireEvent.submit(paymentForm());
    expect(await screen.findByText(expected)).toBeVisible();
  });

  it("builds the complete order and displays submitted confirmation", async () => {
    renderPayment();
    setPostcode();
    fireEvent.change(screen.getByRole("textbox", { name: /Email address.*Required/ }), { target: { value: "pat@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /First name.*Required/ }), { target: { value: "Pat" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Street address.*Required/ }), { target: { value: "1 Paw St" } });
    fireEvent.submit(paymentForm());
    expect(await screen.findByText(/payment was submitted/)).toBeVisible();
    expect(mocks.buildOrderPayload).toHaveBeenCalledWith(expect.objectContaining({
      cart,
      coupon: "SAVE",
      details: expect.objectContaining({
        email: "pat@example.com",
        marketingSubscription: true,
        billingSameAsShipping: true,
      }),
    }));
    expect(mocks.trackEvent).toHaveBeenCalledWith("InitiatePurchase", { safe: true });
    expect(mocks.stripe.current!.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      clientSecret: "client-secret",
    }));
  });

  it("uses locale fallbacks and records an unchecked marketing preference", async () => {
    const language = vi.spyOn(navigator, "language", "get").mockReturnValue("");
    const dateTime = vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ timeZone: "" }),
    } as Intl.DateTimeFormat);
    renderPayment();
    setPostcode();
    fireEvent.click(screen.getByRole("checkbox", { name: /Email me occasional/ }));
    fireEvent.submit(paymentForm());
    await screen.findByText(/payment was submitted/);
    expect(mocks.buildOrderPayload).toHaveBeenCalledWith(expect.objectContaining({
      culture: "en-AU",
      timeZone: "UTC",
      details: expect.objectContaining({ marketingSubscription: false }),
    }));
    language.mockRestore();
    dateTime.mockRestore();
  });

  it.each([
    [new Error("Order service unavailable"), "Order service unavailable"],
    [null, "We could not complete your order. Please try again or contact support."],
  ])("shows safe order failures", async (reason, expected) => {
    mocks.requestOrder.mockRejectedValueOnce(reason);
    renderPayment();
    setPostcode();
    fireEvent.submit(paymentForm());
    expect(await screen.findByText(expected)).toBeVisible();
  });

  it("prevents a second submission while the first is pending", async () => {
    let resolve!: (value: object) => void;
    mocks.elements.current!.submit.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderPayment();
    setPostcode();
    const form = paymentForm();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.elements.current!.submit).toHaveBeenCalledOnce();
    resolve({ error: { message: "Stop" } });
    expect(await screen.findByText("Stop")).toBeVisible();
  });
});

describe("CheckoutFlow", () => {
  it("blocks a missing offer with a customer-visible return path", () => {
    mocks.search.value = "";
    render(<CheckoutFlow />);
    expect(screen.getByRole("heading", { name: "Choose an offer first" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose an offer" })).toHaveAttribute("href", "/#choose-your-set");
  });

  it("supports a resolved offer without a query value and an empty starting coupon", async () => {
    mocks.search.value = "";
    mocks.requireOfferOption.mockReturnValue(offer);
    mocks.selectCoupon.mockReturnValue(null);
    mocks.requestQuote.mockResolvedValue(quote);
    render(<CheckoutFlow />);
    expect(await screen.findByTestId("elements")).toBeInTheDocument();
    fireEvent.focus(screen.getByRole("textbox", { name: /Email address.*Required/ }));
    expect(mocks.checkoutEventPayload).toHaveBeenCalledWith("", "AU", quote);
  });

  it("shows script loading errors and retries once the quote vendor is ready", async () => {
    delete window.niobium;
    mocks.requestQuote.mockResolvedValue(quote);
    render(<CheckoutFlow />);
    expect(mocks.loadStripe).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "quote script error" }));
    expect(screen.getByText(/could not load current pricing/)).toBeVisible();
    window.niobium = { store: { getQuote: vi.fn(), makeOrder: vi.fn(), trackOrder: vi.fn() } };
    await userEvent.click(screen.getByRole("button", { name: "quote ready" }));
    expect(await screen.findByTestId("elements")).toBeInTheDocument();
    expect(mocks.loadStripe).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "quote ready" }));
    expect(mocks.requestQuote).toHaveBeenCalledOnce();
  });

  it("loads a landing coupon, defers checkout-start tracking, and applies a manual coupon", async () => {
    mocks.search.value = "offer=2&coupon=LANDING";
    let resolve!: (value: typeof quote) => void;
    mocks.requestQuote.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<CheckoutFlow />);
    await userEvent.click(screen.getByRole("button", { name: "Add or change coupon" }));
    expect(mocks.trackEvent).not.toHaveBeenCalledWith("StartCheckoutForm", expect.anything());
    resolve(quote);
    await screen.findByTestId("elements");
    expect(mocks.trackEvent).toHaveBeenCalledWith("StartCheckoutForm", { safe: true });

    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "MANUAL" } });
    mocks.requestQuote.mockResolvedValueOnce({ ...quote, id: "quote-3", coupon: "MANUAL" });
    fireEvent.submit(screen.getByLabelText("Coupon code").closest("form")!);
    await screen.findByText("Coupon applied to this order: MANUAL");
    fireEvent.focus(screen.getByRole("textbox", { name: /Email address.*Required/ }));
    expect(mocks.trackEvent.mock.calls.filter(([name]) => name === "StartCheckoutForm")).toHaveLength(1);
  });

  it.each([
    [new Error("Safe quote error"), "Safe quote error"],
    [false, "We could not refresh the price right now. Please retry before payment."],
  ])("shows quote failures and allows retry", async (reason, expected) => {
    mocks.requestQuote.mockRejectedValueOnce(reason).mockResolvedValueOnce(quote);
    render(<CheckoutFlow />);
    expect(await screen.findByText(expected)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("elements")).toBeInTheDocument();
  });

  it("ignores stale quote successes and failures", async () => {
    let resolveInitial!: (value: typeof quote) => void;
    let rejectInitial!: (reason: unknown) => void;
    const stale = new Promise<typeof quote>((resolve, reject) => {
      resolveInitial = resolve;
      rejectInitial = reject;
    });
    mocks.requestQuote.mockReturnValueOnce(stale).mockResolvedValueOnce({ ...quote, id: "new", coupon: "NEW" });
    render(<CheckoutFlow />);
    await userEvent.click(screen.getByRole("button", { name: "Add or change coupon" }));
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "NEW" } });
    fireEvent.submit(screen.getByLabelText("Coupon code").closest("form")!);
    expect(await screen.findByText("Coupon applied to this order: NEW")).toBeVisible();
    resolveInitial(quote);
    await waitFor(() => expect(screen.getByText("Coupon applied to this order: NEW")).toBeVisible());

    const retry = new Promise<typeof quote>((_resolve, reject) => { rejectInitial = reject; });
    mocks.requestQuote.mockReturnValueOnce(retry).mockResolvedValueOnce({ ...quote, id: "newer", coupon: "NEXT" });
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "OLD" } });
    fireEvent.submit(screen.getByLabelText("Coupon code").closest("form")!);
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "NEXT" } });
    fireEvent.submit(screen.getByLabelText("Coupon code").closest("form")!);
    expect(await screen.findByText("Coupon applied to this order: NEXT")).toBeVisible();
    rejectInitial(new Error("stale"));
    await waitFor(() => expect(screen.queryByText("stale")).not.toBeInTheDocument());
  });
});
