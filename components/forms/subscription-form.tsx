"use client";

import { type FormEvent, useState } from "react";

import { SubscribeVendorScript } from "@/components/integrations/third-party-scripts";
import { publicEnv } from "@/lib/public-env";
import { subscribeToUpdates } from "@/lib/support";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function SubscriptionForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("subscription-email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setState("submitting");
    setMessage("");
    try {
      await subscribeToUpdates(
        {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          TENANT_ID: publicEnv.tenantId,
          APP_NAME: publicEnv.appName,
          NOTIFICATION_INTEGRATION_ENDPOINT: publicEnv.notificationIntegrationEndpoint,
        },
        email,
      );
      setState("success");
      setMessage("You are signed up for email updates.");
      formElement.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not complete your subscription. Please try again.");
    }
  }

  return (
    <div className="subscription" data-subscription-slot="true" id="email-updates">
      <p className="subscription__title">Helpful dog-care updates</p>
      <p className="subscription__copy">Occasional PawTrim tips and product updates by email.</p>
      <form noValidate onSubmit={handleSubmit}>
        <label htmlFor="subscription-email">Email address</label>
        <div className="subscription__row">
          <input
            autoComplete="email"
            disabled={state === "submitting" || state === "success"}
            id="subscription-email"
            inputMode="email"
            name="subscription-email"
            placeholder="you@example.com"
            required
            type="email"
          />
          <button
            className="button button--accent"
            disabled={state === "submitting" || state === "success"}
            type="submit"
          >
            {state === "submitting" ? "Signing up..." : state === "success" ? "Signed up" : "Sign up"}
          </button>
        </div>
      </form>
      {message ? (
        <p aria-live="polite" className={`form-message form-message--${state}`}>
          {message}
        </p>
      ) : null}
      <SubscribeVendorScript siteKey={publicEnv.googleRecaptchaSiteKey} />
    </div>
  );
}
