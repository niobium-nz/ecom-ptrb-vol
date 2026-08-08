"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useSyncExternalStore } from "react";

import { internalUrl } from "@/lib/query-params";
import { trackEvent } from "@/lib/tracking";

type PreservedLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  "data-analytics-event"?: string;
  "data-offer-option"?: string;
};

export function subscribeToLocationChange(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

export function getCurrentSearch() {
  return window.location.search;
}

export function getServerSearch() {
  return "";
}

export function withPreservedQuery(href: string, currentSearch: string) {
  if (href.startsWith("#")) return href;

  const target = new URL(href, "https://niobium.local");
  const extras = Object.fromEntries(target.searchParams.entries());
  const internalHref = internalUrl(target.pathname, currentSearch, extras);
  return `${internalHref}${target.hash}`;
}

export function PreservedLink({
  href,
  onClick,
  "data-analytics-event": analyticsEvent,
  "data-offer-option": offerOption,
  ...props
}: PreservedLinkProps) {
  const currentSearch = useSyncExternalStore(
    subscribeToLocationChange,
    getCurrentSearch,
    getServerSearch,
  );

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (analyticsEvent === "CTAClick") {
      trackEvent("CTAClick", {
        offer_option: offerOption,
      });
    }
  }

  return (
    <a
      href={withPreservedQuery(href, currentSearch)}
      onClick={handleClick}
      data-analytics-event={analyticsEvent}
      data-offer-option={offerOption}
      {...props}
    />
  );
}
