"use client";

import { type FormEvent, useState } from "react";

import { ContactVendorScript } from "@/components/integrations/third-party-scripts";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/public-env";
import { sendContactMessage } from "@/lib/support";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const visitorMessage = String(form.get("message") ?? "").trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !visitorMessage) {
      setState("error");
      setMessage("Enter your name, a valid email address and your message.");
      return;
    }

    setState("submitting");
    setMessage("");
    try {
      await sendContactMessage(
        {
          GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
          TENANT_ID: publicEnv.tenantId,
          APP_NAME: publicEnv.appName,
          NOTIFICATION_INTEGRATION_ENDPOINT: publicEnv.notificationIntegrationEndpoint,
        },
        name,
        email,
        visitorMessage,
      );
      setState("success");
      setMessage("Thanks. Your message has been sent and our support team will reply by email.");
      formElement.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not send your message. Please try again.");
    }
  }

  return (
    <>
      <form className="support-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Name <small>Required</small></span>
          <input autoComplete="name" disabled={state === "submitting"} name="name" required />
        </label>
        <label className="form-field">
          <span>Email address <small>Required</small></span>
          <input autoComplete="email" disabled={state === "submitting"} inputMode="email" name="email" required type="email" />
        </label>
        <label className="form-field">
          <span>How can we help? <small>Required</small></span>
          <textarea disabled={state === "submitting"} name="message" required rows={6} />
        </label>
        <Button disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Sending..." : "Send message"}
        </Button>
        {message ? <p aria-live="polite" className={`form-message form-message--${state}`}>{message}</p> : null}
      </form>
      <ContactVendorScript
        onError={() => {
          setState("error");
          setMessage(`The contact form could not load. Please email ${publicEnv.contactEmail}.`);
        }}
        siteKey={publicEnv.googleRecaptchaSiteKey}
      />
    </>
  );
}
