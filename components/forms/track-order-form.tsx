"use client";

import { type FormEvent, useState } from "react";

import { TrackVendorScript } from "@/components/integrations/third-party-scripts";
import { publicEnv } from "@/lib/public-env";
import { trackOrder, type TrackResponse } from "@/lib/support";

type LookupMethod = "order" | "name";

const orderStatusLabels: Record<number, string> = {
  0: "Created",
  10: "Partially paid",
  20: "Paid",
  30: "Shipped",
  40: "Delivered",
  50: "Completed",
  60: "Cancelled",
  70: "Refunded",
};

const shippingStatusLabels: Record<number, string> = {
  0: "Not applicable",
  1: "Preparing for dispatch",
  2: "Processed",
  3: "Shipped",
  4: "With customs",
  5: "Out for delivery",
  6: "Delivery attempt made",
  7: "Delivered",
  8: "Returned",
  9: "Cancelled",
};

function statusLabel(labels: Record<number, string>, value: number): string {
  return labels[value] ?? "Status update available";
}

export function TrackOrderForm() {
  const [method, setMethod] = useState<LookupMethod>("order");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<TrackResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Enter a valid email address.");
      setResult(null);
      return;
    }

    let lookup: { email: string; order: number } | { email: string; firstName: string };
    if (method === "order") {
      const rawOrder = String(form.get("order") ?? "").trim();
      if (!/^[1-9]\d*$/.test(rawOrder) || !Number.isSafeInteger(Number(rawOrder))) {
        setMessage("Enter your numeric order number without a leading zero.");
        setResult(null);
        return;
      }
      lookup = { email, order: Number(rawOrder) };
    } else {
      const firstName = String(form.get("firstName") ?? "").trim();
      if (!firstName) {
        setMessage("Enter the first name used for the order.");
        setResult(null);
        return;
      }
      lookup = { email, firstName: firstName.toLocaleLowerCase("en-AU") };
    }

    setLoading(true);
    setMessage("");
    setResult(null);
    try {
      const tracking = await trackOrder(
        {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          STORE_INTEGRATION_ENDPOINT: publicEnv.storeIntegrationEndpoint,
        },
        lookup,
      );
      setResult(tracking);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not retrieve tracking details. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="support-form" onSubmit={handleSubmit}>
        <fieldset className="lookup-methods">
          <legend>Find your order with</legend>
          <label>
            <input checked={method === "order"} name="lookupMethod" onChange={() => setMethod("order")} type="radio" />
            <span>Order number</span>
          </label>
          <label>
            <input checked={method === "name"} name="lookupMethod" onChange={() => setMethod("name")} type="radio" />
            <span>First name</span>
          </label>
        </fieldset>
        <label className="form-field">
          <span>Email address <small>Required</small></span>
          <input autoComplete="email" disabled={loading} inputMode="email" name="email" required type="email" />
        </label>
        {method === "order" ? (
          <label className="form-field">
            <span>Order number <small>Required</small></span>
            <input disabled={loading} inputMode="numeric" name="order" pattern="[1-9][0-9]*" required />
          </label>
        ) : (
          <label className="form-field">
            <span>First name <small>Required</small></span>
            <input autoComplete="given-name" disabled={loading} name="firstName" required />
          </label>
        )}
        <button className="button button--primary" disabled={loading} type="submit">
          {loading ? "Finding your order..." : "Track order"}
        </button>
        {message ? <p className="form-message form-message--error" role="alert">{message}</p> : null}
      </form>

      {result ? (
        <section aria-live="polite" className="tracking-result" data-tracking-result="true">
          <p className="eyebrow">Order update</p>
          <h2>{shippingStatusLabels[result.shippingStatus] ?? orderStatusLabels[result.status] ?? "Order found"}</h2>
          <dl>
            <div><dt>Order status</dt><dd>{statusLabel(orderStatusLabels, result.status)}</dd></div>
            <div><dt>Delivery status</dt><dd>{statusLabel(shippingStatusLabels, result.shippingStatus)}</dd></div>
            <div><dt>Delivery area</dt><dd>{[result.shippingCity, result.shippingState, result.shippingCountry].filter(Boolean).join(", ")}</dd></div>
            <div><dt>Order created</dt><dd>{result.created}</dd></div>
          </dl>
          <div className="tracking-items">
            <h3>Items</h3>
            <ul>
              {result.cart.map((item, index) => (
                <li key={`${item.listing}-${item.option}-${index}`}>
                  <span>{item.name?.trim() || `Item ${item.listing}`}</span>
                  <strong>× {item.quantity}</strong>
                </li>
              ))}
            </ul>
          </div>
          <p>Delivery is tracked. Tracking details are also sent by email after dispatch.</p>
        </section>
      ) : null}

      <TrackVendorScript
        onError={() => setMessage("Order tracking could not load. Please check your connection and try again.")}
        siteKey={publicEnv.googleRecaptchaSiteKey}
      />
    </>
  );
}
