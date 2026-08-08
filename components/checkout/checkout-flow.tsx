"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  OrderVendorScript,
  QuoteVendorScript,
} from "@/components/integrations/third-party-scripts";
import { PreservedLink } from "@/components/navigation/preserved-link";
import {
  checkoutFieldConfig,
  normalizePostcode,
  validPostcode,
} from "@/lib/checkout-fields";
import { selectCoupon } from "@/lib/coupon";
import {
  parseVendorCart,
  requireOfferOption,
  type OfferOption,
  type VendorCartItem,
} from "@/lib/offers";
import {
  buildOrderPayload,
  requestOrder,
  type CheckoutDetails,
} from "@/lib/order";
import { publicEnv } from "@/lib/public-env";
import { requestQuote, type QuoteResponse } from "@/lib/quote";
import { checkoutEventPayload, trackEvent } from "@/lib/tracking";
import { formatMoneyFromCents } from "@/lib/utils";

type OfferResolution = {
  offer: OfferOption;
  cart: VendorCartItem[];
};

type QuoteState = {
  quote: QuoteResponse | null;
  loading: boolean;
  error: string;
  activeCoupon: string | null;
  requestedCoupon: string | null;
};

export function customerMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function resolveOffer(offerKey: string | null): OfferResolution {
  const offer = requireOfferOption(offerKey);
  const rawCart = publicEnv.offerOptions[
    offer.offer_option_key as keyof typeof publicEnv.offerOptions
  ];
  return {
    offer,
    cart: parseVendorCart(rawCart, offer.offer_option_key),
  };
}

export function QuoteSummary({
  offer,
  state,
  couponDraft,
  couponOpen,
  onCouponDraftChange,
  onCouponSubmit,
  onCouponToggle,
  onRetry,
  onStart,
}: {
  offer: OfferOption;
  state: QuoteState;
  couponDraft: string;
  couponOpen: boolean;
  onCouponDraftChange: (value: string) => void;
  onCouponSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCouponToggle: () => void;
  onRetry: () => void;
  onStart: () => void;
}) {
  const quote = state.quote;

  return (
    <section
      aria-busy={state.loading}
      className="checkout-card checkout-summary"
      data-checkout-order-summary="true"
    >
      <div className="checkout-card__heading">
        <div>
          <p className="eyebrow">Your order</p>
          <h2>{offer.name}</h2>
        </div>
        {state.loading ? <span className="loading-chip">Refreshing...</span> : null}
      </div>

      {!quote && state.loading ? (
        <div aria-live="polite" className="quote-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Getting your current price...
        </div>
      ) : null}

      {quote ? (
        <div className={state.loading || state.error ? "quote-breakdown quote-breakdown--stale" : "quote-breakdown"}>
          <div className="quote-lines">
            {quote.quote.map((line, index) => (
              <div className="quote-row" key={`${line.listing}-${line.option ?? "default"}-${index}`}>
                <span>
                  {line.name?.trim() || offer.name} × {line.quantity}
                </span>
                <strong>{formatMoneyFromCents(line.lineTotal, quote.currency)}</strong>
              </div>
            ))}
          </div>
          <div className="quote-row quote-row--muted">
            <span>Subtotal</span>
            <span>{formatMoneyFromCents(quote.subtotal, quote.currency)}</span>
          </div>
          {quote.discount > 0 ? (
            <div className="quote-row quote-row--discount">
              <span>Discount</span>
              <span>-{formatMoneyFromCents(quote.discount, quote.currency)}</span>
            </div>
          ) : null}
          <div className="quote-row quote-row--muted">
            <span>{quote.shippingDescription?.trim() || "Tracked delivery"}</span>
            <span>{formatMoneyFromCents(quote.shippingCost, quote.currency)}</span>
          </div>
          {quote.tax > 0 ? (
            <div className="quote-row quote-row--muted">
              <span>Tax</span>
              <span>{formatMoneyFromCents(quote.tax, quote.currency)}</span>
            </div>
          ) : null}
          <div className="quote-row quote-row--total">
            <span>Total</span>
            <strong>{formatMoneyFromCents(quote.total, quote.currency)}</strong>
          </div>
          <p className="quote-currency">Total shown in {quote.currency}.</p>
        </div>
      ) : null}

      {state.activeCoupon ? (
        <p className="coupon-applied" data-coupon-applied="true">Coupon applied to this order: {state.activeCoupon}</p>
      ) : null}

      {state.error ? (
        <div className="form-message form-message--error" role="alert">
          <p>{state.error}</p>
          <button className="text-button" disabled={state.loading} onClick={onRetry} type="button">
            Try again
          </button>
        </div>
      ) : null}

      <div className="checkout-coupon" data-checkout-coupon="true">
        <button
          aria-expanded={couponOpen}
          className="coupon-toggle"
          data-coupon-toggle="true"
          onClick={() => {
            onStart();
            onCouponToggle();
          }}
          type="button"
        >
          {state.activeCoupon ? "Change coupon" : "Add or change coupon"}
          <span aria-hidden="true">{couponOpen ? "−" : "+"}</span>
        </button>
        {couponOpen ? (
          <form className="coupon-form" onFocusCapture={onStart} onSubmit={onCouponSubmit}>
            <label htmlFor="checkout-coupon">Coupon code</label>
            <div>
              <input
                autoCapitalize="characters"
                disabled={state.loading}
                id="checkout-coupon"
                name="coupon"
                onChange={(event) => onCouponDraftChange(event.target.value)}
                value={couponDraft}
              />
              <button className="button button--secondary" disabled={state.loading} type="submit">
                {state.loading ? "Checking..." : state.activeCoupon ? "Update coupon" : "Apply coupon"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <p className="checkout-delivery-note">
        Tracked delivery to Australia is estimated at 7 - 14 business days. Tracking details are emailed after dispatch.
      </p>
    </section>
  );
}

export function inputValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

export function CheckoutPaymentForm({
  offerKey,
  cart,
  coupon,
  quote,
  paymentBlocked,
  onStart,
}: {
  offerKey: string;
  cart: VendorCartItem[];
  coupon: string | null;
  quote: QuoteResponse;
  paymentBlocked: boolean;
  onStart: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const fields = checkoutFieldConfig(publicEnv.targetCountry);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || paymentBlocked || !stripe || !elements) return;

    const form = new FormData(event.currentTarget);
    const postcode = normalizePostcode(
      publicEnv.targetCountry as "AU",
      inputValue(form, "shippingPostcode"),
    );
    if (!validPostcode(publicEnv.targetCountry as "AU", postcode)) {
      setError("Enter a valid 4-digit Australian postcode.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    trackEvent(
      "InitiatePurchase",
      checkoutEventPayload(offerKey, publicEnv.targetCountry, quote),
    );

    const validation = await elements.submit();
    if (validation.error) {
      setError(validation.error.message || "Check your payment details and try again.");
      setSubmitting(false);
      return;
    }

    const details: CheckoutDetails = {
      email: inputValue(form, "email"),
      firstName: inputValue(form, "firstName"),
      lastName: inputValue(form, "lastName"),
      phone: inputValue(form, "phone"),
      shippingAddressLine1: inputValue(form, "shippingAddressLine1"),
      shippingAddressLine2: inputValue(form, "shippingAddressLine2"),
      shippingCity: inputValue(form, "shippingCity"),
      shippingState: inputValue(form, "shippingState"),
      shippingPostcode: postcode,
      notes: inputValue(form, "notes"),
      marketingSubscription: form.get("marketingSubscription") === "on",
      billingSameAsShipping,
      billingName: inputValue(form, "billingName"),
      billingAddressLine1: inputValue(form, "billingAddressLine1"),
      billingAddressLine2: inputValue(form, "billingAddressLine2"),
      billingCity: inputValue(form, "billingCity"),
      billingState: inputValue(form, "billingState"),
      billingPostcode: inputValue(form, "billingPostcode"),
    };

    try {
      const payload = buildOrderPayload({
        config: {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          TENANT_ID: publicEnv.tenantId,
          shipping_option_id: publicEnv.shippingOptionId,
          TARGET_COUNTRY: publicEnv.targetCountry,
          STORE_INTEGRATION_ENDPOINT: publicEnv.storeIntegrationEndpoint,
        },
        details,
        cart,
        coupon,
        culture: navigator.language || "en-AU",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      const order = await requestOrder(
        {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          TENANT_ID: publicEnv.tenantId,
          shipping_option_id: publicEnv.shippingOptionId,
          TARGET_COUNTRY: publicEnv.targetCountry,
          STORE_INTEGRATION_ENDPOINT: publicEnv.storeIntegrationEndpoint,
        },
        payload,
      );
      const confirmation = await stripe.confirmPayment({
        elements,
        clientSecret: order.instruction,
        confirmParams: {
          return_url: new URL("/order-status", window.location.origin).toString(),
        },
      });
      if (confirmation.error) {
        setError(confirmation.error.message || "We could not confirm your payment. Please try again.");
        setSubmitting(false);
        return;
      }
      setNotice("Your payment was submitted. Please wait while we confirm your order.");
    } catch (caught) {
      setError(customerMessage(caught, "We could not complete your order. Please try again or contact support."));
      setSubmitting(false);
    }
  }

  return (
    <form
      className="checkout-form"
      data-checkout-shipping-form="true"
      onFocusCapture={onStart}
      onSubmit={handleSubmit}
    >
      <section className="checkout-card checkout-fields" aria-labelledby="delivery-heading">
        <p className="eyebrow">Delivery details</p>
        <h2 id="delivery-heading">Where should we send it?</h2>
        <div className="form-grid">
          <label className="form-field form-field--full">
            <span>Email address <small>Required</small></span>
            <input autoComplete="email" inputMode="email" name="email" required type="email" />
          </label>
          <label className="form-field">
            <span>First name <small>Required</small></span>
            <input autoComplete="given-name" name="firstName" required />
          </label>
          <label className="form-field">
            <span>Last name <small>Optional</small></span>
            <input autoComplete="family-name" name="lastName" />
          </label>
          <label className="form-field form-field--full">
            <span>Phone <small>Optional</small></span>
            <input autoComplete="tel" inputMode="tel" name="phone" />
          </label>
          <label className="form-field form-field--full">
            <span>Street address <small>Required</small></span>
            <input autoComplete="address-line1" name="shippingAddressLine1" required />
          </label>
          <label className="form-field form-field--full">
            <span>Apartment, unit, etc. <small>Optional</small></span>
            <input autoComplete="address-line2" name="shippingAddressLine2" />
          </label>
          <label className="form-field">
            <span>{fields.cityLabel} <small>Required</small></span>
            <input autoComplete="address-level2" name="shippingCity" required />
          </label>
          <label className="form-field">
            <span>{fields.stateLabel} <small>Required</small></span>
            <select autoComplete="address-level1" name="shippingState" required>
              <option value="">Select</option>
              {[
                ["ACT", "Australian Capital Territory"],
                ["NSW", "New South Wales"],
                ["NT", "Northern Territory"],
                ["QLD", "Queensland"],
                ["SA", "South Australia"],
                ["TAS", "Tasmania"],
                ["VIC", "Victoria"],
                ["WA", "Western Australia"],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field form-field--full">
            <span>{fields.postcodeLabel} <small>Required</small></span>
            <input
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={4}
              name="shippingPostcode"
              pattern="[0-9]{4}"
              required
            />
          </label>
          <label className="form-field form-field--full">
            <span>Order notes <small>Optional</small></span>
            <textarea name="notes" rows={3} />
          </label>
        </div>

        <label className="check-control">
          <input
            checked={billingSameAsShipping}
            name="billingSameAsShipping"
            onChange={(event) => setBillingSameAsShipping(event.target.checked)}
            type="checkbox"
          />
          <span>Billing address is the same as delivery</span>
        </label>

        {!billingSameAsShipping ? (
          <fieldset className="billing-fields">
            <legend>Billing address</legend>
            <p>These fields are optional. Add the details shown on your payment method if they differ.</p>
            <div className="form-grid">
              <label className="form-field form-field--full"><span>Name <small>Optional</small></span><input autoComplete="cc-name" name="billingName" /></label>
              <label className="form-field form-field--full"><span>Street address <small>Optional</small></span><input autoComplete="billing address-line1" name="billingAddressLine1" /></label>
              <label className="form-field form-field--full"><span>Apartment, unit, etc. <small>Optional</small></span><input autoComplete="billing address-line2" name="billingAddressLine2" /></label>
              <label className="form-field"><span>Suburb <small>Optional</small></span><input autoComplete="billing address-level2" name="billingCity" /></label>
              <label className="form-field"><span>State/Territory <small>Optional</small></span><input autoComplete="billing address-level1" name="billingState" /></label>
              <label className="form-field form-field--full"><span>Postcode <small>Optional</small></span><input autoComplete="billing postal-code" inputMode="numeric" name="billingPostcode" /></label>
            </div>
          </fieldset>
        ) : null}

        <label className="check-control">
          <input defaultChecked name="marketingSubscription" type="checkbox" />
          <span>Email me occasional PawTrim tips and product updates</span>
        </label>
      </section>

      <section
        className="checkout-card checkout-payment"
        data-checkout-payment="true"
        onClick={onStart}
        onFocusCapture={onStart}
      >
        <p className="eyebrow">Payment</p>
        <h2>Pay securely</h2>
        <p className="checkout-payment__intro">Enter your payment details below to complete your order.</p>
        <div aria-busy={!paymentReady || paymentBlocked} className="payment-element-wrap">
          <PaymentElement
            onChange={onStart}
            onReady={() => setPaymentReady(true)}
          />
        </div>
        {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
        {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
        <button
          className="button button--primary button--full"
          disabled={submitting || paymentBlocked || !stripe || !elements || !paymentReady}
          type="submit"
        >
          {submitting ? "Completing your order..." : paymentBlocked ? "Refresh price to continue" : "Pay securely"}
        </button>
        <p className="payment-reassurance">Your payment details are handled securely by Stripe.</p>
      </section>
    </form>
  );
}

export function CheckoutFlow() {
  const searchParams = useSearchParams();
  const offerKey = searchParams.get("offer");
  const landingCoupon = searchParams.get("coupon");
  const resolution = useMemo(() => {
    try {
      return { value: resolveOffer(offerKey), error: "" };
    } catch (error) {
      return {
        value: null,
        error: customerMessage(
          error,
          "We could not identify the selected offer. Please return to the product page and choose an offer again.",
        ),
      };
    }
  }, [offerKey]);
  const startingCoupon = useMemo(
    () => selectCoupon({ landing: landingCoupon, fallback: publicEnv.fallbackCoupon }),
    [landingCoupon],
  );
  const [couponDraft, setCouponDraft] = useState(startingCoupon ?? "");
  const [couponOpen, setCouponOpen] = useState(false);
  const [quoteState, setQuoteState] = useState<QuoteState>({
    quote: null,
    loading: true,
    error: "",
    activeCoupon: null,
    requestedCoupon: startingCoupon,
  });
  const stripePromise = useMemo(
    () => quoteState.quote ? loadStripe(publicEnv.stripePublicKey) : null,
    [quoteState.quote],
  );
  const requestNumber = useRef(0);
  const firstQuoteStarted = useRef(false);
  const checkoutStarted = useRef(false);
  const pendingCheckoutStart = useRef(false);

  const loadQuote = useCallback(async (coupon: string | null) => {
    const resolvedOffer = resolution.value as OfferResolution;
    const currentRequest = ++requestNumber.current;
    setQuoteState((current) => ({
      ...current,
      loading: true,
      error: "",
      requestedCoupon: coupon,
    }));
    try {
      const quote = await requestQuote(
        {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          TENANT_ID: publicEnv.tenantId,
          shipping_option_id: publicEnv.shippingOptionId,
          TARGET_COUNTRY: publicEnv.targetCountry,
          STORE_INTEGRATION_ENDPOINT: publicEnv.storeIntegrationEndpoint,
        },
        resolvedOffer.cart,
        coupon,
      );
      if (currentRequest !== requestNumber.current) return;
      setQuoteState({
        quote,
        loading: false,
        error: "",
        activeCoupon: coupon,
        requestedCoupon: coupon,
      });
    } catch (error) {
      if (currentRequest !== requestNumber.current) return;
      setQuoteState((current) => ({
        ...current,
        loading: false,
        error: customerMessage(error, "We could not refresh the price right now. Please retry before payment."),
      }));
    }
  }, [resolution.value]);

  const beginFirstQuote = useCallback(() => {
    if (firstQuoteStarted.current || !resolution.value || !window.niobium?.store?.getQuote) return;
    firstQuoteStarted.current = true;
    void loadQuote(startingCoupon);
  }, [loadQuote, resolution.value, startingCoupon]);

  const markCheckoutStarted = useCallback(() => {
    if (checkoutStarted.current) return;
    if (!quoteState.quote) {
      pendingCheckoutStart.current = true;
      return;
    }
    checkoutStarted.current = true;
    pendingCheckoutStart.current = false;
    trackEvent(
      "StartCheckoutForm",
      checkoutEventPayload(offerKey ?? "", publicEnv.targetCountry, quoteState.quote),
    );
  }, [offerKey, quoteState.quote]);

  useEffect(() => {
    beginFirstQuote();
  }, [beginFirstQuote]);

  useEffect(() => {
    if (pendingCheckoutStart.current && quoteState.quote) markCheckoutStarted();
  }, [markCheckoutStarted, quoteState.quote]);

  if (!resolution.value) {
    return (
      <section className="checkout-card checkout-blocking-error" role="alert">
        <h2>Choose an offer first</h2>
        <p>{resolution.error}</p>
        <PreservedLink className="button button--primary" href="/#choose-your-set">Choose an offer</PreservedLink>
      </section>
    );
  }

  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    markCheckoutStarted();
    const coupon = selectCoupon({
      manual: couponDraft,
      landing: landingCoupon,
      fallback: publicEnv.fallbackCoupon,
    });
    void loadQuote(coupon);
  }

  const paymentBlocked = quoteState.loading || Boolean(quoteState.error) || !quoteState.quote;

  return (
    <div className="checkout-stack">
      <QuoteSummary
        couponDraft={couponDraft}
        couponOpen={couponOpen}
        offer={resolution.value.offer}
        onCouponDraftChange={setCouponDraft}
        onCouponSubmit={applyCoupon}
        onCouponToggle={() => setCouponOpen((open) => !open)}
        onRetry={() => void loadQuote(quoteState.requestedCoupon)}
        onStart={markCheckoutStarted}
        state={quoteState}
      />

      {quoteState.quote ? (
        <Elements
          key={`${quoteState.quote.id}-${quoteState.quote.total}-${quoteState.quote.currency}`}
          options={{
            mode: "payment",
            amount: quoteState.quote.total,
            currency: quoteState.quote.currency.toLowerCase(),
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#1f6e6e",
                colorText: "#18302f",
                borderRadius: "12px",
                fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
              },
            },
          }}
          stripe={stripePromise}
        >
          <CheckoutPaymentForm
            cart={resolution.value.cart}
            coupon={quoteState.activeCoupon}
            offerKey={resolution.value.offer.offer_option_key}
            onStart={markCheckoutStarted}
            paymentBlocked={paymentBlocked}
            quote={quoteState.quote}
          />
        </Elements>
      ) : null}

      <QuoteVendorScript
        onError={() => setQuoteState((current) => ({
          ...current,
          loading: false,
          error: "We could not load current pricing. Please check your connection and try again.",
        }))}
        onReady={beginFirstQuote}
        siteKey={publicEnv.googleRecaptchaSiteKey}
      />
      <OrderVendorScript siteKey={publicEnv.googleRecaptchaSiteKey} />
    </div>
  );
}
