"use client";

import { useEffect, useRef, useState } from "react";

import { QuoteVendorScript } from "@/components/integrations/third-party-scripts";
import { PreservedLink } from "@/components/navigation/preserved-link";
import { Badge } from "@/components/ui/badge";
import { parseVendorCart } from "@/lib/offers";
import { publicEnv } from "@/lib/public-env";
import { requestQuote } from "@/lib/quote";
import { trackEvent } from "@/lib/tracking";
import { formatMoneyFromCents } from "@/lib/utils";

export type OfferOption = {
  source_offer_key: string;
  offer_option_key: string;
  recommended: boolean;
  name: string;
  default_price: {
    amount_cents: number;
    currency: string;
  };
};

type OfferSelectorProps = {
  offers: readonly OfferOption[];
};

type DisplayPrice = {
  amountCents: number;
  currency: string;
  source: "default" | "quote";
};

const offerContext: Record<string, string> = {
  "1": "One board for one dog or one main room.",
  "2": "Two boards for two dogs or a consistent two-room routine.",
  "3": "Three boards for a multi-dog or multi-room household.",
};

function checkoutHref(offerOptionKey: string) {
  return `/checkout?offer=${encodeURIComponent(offerOptionKey)}`;
}

export function OfferSelector({ offers }: OfferSelectorProps) {
  const recommendedOffer = offers.find((offer) => offer.recommended);

  if (!recommendedOffer || recommendedOffer.offer_option_key !== "2") {
    throw new Error("Offer option 2 must be the recommended home-page offer.");
  }

  const [selectedKey, setSelectedKey] = useState("2");
  const [showStickyAction, setShowStickyAction] = useState(false);
  const [quoteScriptReady, setQuoteScriptReady] = useState(false);
  const [prices, setPrices] = useState<Record<string, DisplayPrice>>(() =>
    Object.fromEntries(
      offers.map((offer) => [
        offer.offer_option_key,
        {
          amountCents: offer.default_price.amount_cents,
          currency: offer.default_price.currency,
          source: "default" as const,
        },
      ]),
    ),
  );
  const [quoteFailures, setQuoteFailures] = useState<string[]>([]);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);
  const quotesStartedRef = useRef(false);
  const selectedOffer =
    offers.find((offer) => offer.offer_option_key === selectedKey) ?? recommendedOffer;
  const selectedPrice = prices[selectedOffer.offer_option_key];

  useEffect(() => {
    if (quotesStartedRef.current) return;
    if (!quoteScriptReady && !window.niobium?.store?.getQuote) return;
    quotesStartedRef.current = true;

    void Promise.allSettled(
      offers.map(async (offer) => {
        try {
          const rawCart = publicEnv.offerOptions[
            offer.offer_option_key as keyof typeof publicEnv.offerOptions
          ];
          const quote = await requestQuote(
            {
              GOOGLE_RECAPTCHA_SITE_KEY: publicEnv.googleRecaptchaSiteKey,
              TENANT_ID: publicEnv.tenantId,
              shipping_option_id: publicEnv.shippingOptionId,
              TARGET_COUNTRY: publicEnv.targetCountry,
              STORE_INTEGRATION_ENDPOINT: publicEnv.storeIntegrationEndpoint,
            },
            parseVendorCart(rawCart, offer.offer_option_key),
            null,
          );
          setPrices((current) => ({
            ...current,
            [offer.offer_option_key]: {
              amountCents: quote.total,
              currency: quote.currency,
              source: "quote",
            },
          }));
        } catch {
          setQuoteFailures((current) =>
            current.includes(offer.offer_option_key)
              ? current
              : [...current, offer.offer_option_key],
          );
        }
      }),
    );
  }, [offers, quoteScriptReady]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const primaryAction = primaryActionRef.current as HTMLAnchorElement;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyAction(!entry.isIntersecting),
      { threshold: 0.15 },
    );

    observer.observe(primaryAction);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="offer-selector" data-offer-selector="true" id="choose-your-set">
      <fieldset className="offer-selector__fieldset">
        <legend>Choose your set</legend>
        <div className="offer-selector__options">
          {offers.map((offer) => {
            const selected = offer.offer_option_key === selectedKey;
            const displayPrice = prices[offer.offer_option_key];
            const price = formatMoneyFromCents(
              displayPrice.amountCents,
              displayPrice.currency,
            );

            return (
              <label
                className="offer-card"
                data-recommended={offer.recommended ? "true" : undefined}
                data-selected={selected ? "true" : "false"}
                key={offer.offer_option_key}
              >
                <input
                  checked={selected}
                  name="home-offer"
                  onChange={() => {
                    if (offer.offer_option_key !== selectedKey) {
                      setSelectedKey(offer.offer_option_key);
                      trackEvent("OfferSelect", {
                        offer_option: offer.offer_option_key,
                      });
                    }
                  }}
                  type="radio"
                  value={offer.offer_option_key}
                />
                <span className="offer-card__marker" aria-hidden="true" />
                <span className="offer-card__copy">
                  <span className="offer-card__title-row">
                    <strong>{offer.name}</strong>
                    {offer.recommended ? (
                      <Badge tone="recommended">Most popular</Badge>
                    ) : null}
                  </span>
                  <span className="offer-card__description">
                    {offerContext[offer.offer_option_key]}
                  </span>
                </span>
                <span
                  className="offer-card__price"
                  data-default-price-cents={offer.default_price.amount_cents}
                  data-currency={displayPrice.currency}
                  data-price-source={displayPrice.source}
                >
                  {price}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <PreservedLink
        className="button button--primary button--full"
        data-analytics-event="CTAClick"
        data-offer-option={selectedOffer.offer_option_key}
        data-primary-action="true"
        href={checkoutHref(selectedOffer.offer_option_key)}
        ref={primaryActionRef}
      >
        Buy Now
      </PreservedLink>
      <p className="offer-selector__delivery">
        Tracked delivery to Australia: 7 - 14 business days. Tracking is emailed after
        dispatch.
      </p>

      <div
        aria-hidden={!showStickyAction}
        className="sticky-buy"
        data-visible={showStickyAction ? "true" : "false"}
      >
        <div className="sticky-buy__summary">
          <span>{selectedOffer.name}</span>
          <strong>
            {formatMoneyFromCents(selectedPrice.amountCents, selectedPrice.currency)}
          </strong>
        </div>
        <PreservedLink
          className="button button--accent"
          data-analytics-event="CTAClick"
          data-offer-option={selectedOffer.offer_option_key}
          data-primary-action="true"
          href={checkoutHref(selectedOffer.offer_option_key)}
          tabIndex={showStickyAction ? undefined : -1}
        >
          Buy Now
        </PreservedLink>
      </div>
      {quoteFailures.length > 0 ? (
        <p className="offer-selector__price-note" role="status">
          Live price will be confirmed at checkout.
        </p>
      ) : null}
      <QuoteVendorScript
        onError={() => setQuoteFailures(offers.map((offer) => offer.offer_option_key))}
        onReady={() => setQuoteScriptReady(true)}
        siteKey={publicEnv.googleRecaptchaSiteKey}
      />
    </div>
  );
}
