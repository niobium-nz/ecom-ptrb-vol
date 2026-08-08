import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({
    children,
    id,
    onError,
    onReady,
    src,
  }: {
    children?: ReactNode;
    id?: string;
    onError?: () => void;
    onReady?: () => void;
    src?: string;
  }) => (
    <button
      data-id={id}
      data-src={src}
      onClick={onReady}
      onDoubleClick={onError}
      type="button"
    >
      {children ?? src ?? id}
    </button>
  ),
}));

import {
  ContactVendorScript,
  OrderVendorScript,
  QuoteVendorScript,
  SubscribeVendorScript,
  TrackVendorScript,
  TrackingScripts,
} from "@/components/integrations/third-party-scripts";

describe("canonical third-party script components", () => {
  it("renders every configured analytics snippet and omits every missing one", () => {
    const { container, rerender } = render(
      <TrackingScripts clarityId="clarity value" googleTag="G-TEST value" metaPixelId="pixel value" />,
    );
    expect(container.textContent).toContain("gtag('config', \"G-TEST value\")");
    expect(container.textContent).toContain("fbq('init', \"pixel value\")");
    expect(container.textContent).toContain('"clarity value"');

    rerender(<TrackingScripts />);
    expect(container).toBeEmptyDOMElement();
  });

  it("builds all five canonical vendor URLs and forwards ready/error handlers", () => {
    const ready = vi.fn();
    const error = vi.fn();
    render(
      <>
        <QuoteVendorScript onError={error} onReady={ready} siteKey="key value" />
        <OrderVendorScript onError={error} onReady={ready} siteKey="key value" />
        <SubscribeVendorScript onError={error} onReady={ready} siteKey="key value" />
        <ContactVendorScript onError={error} onReady={ready} siteKey="key value" />
        <TrackVendorScript onError={error} onReady={ready} siteKey="key value" />
        <QuoteVendorScript siteKey="plain" />
      </>,
    );

    const scripts = screen.getAllByRole("button");
    expect(scripts.map((script) => script.getAttribute("data-src"))).toEqual([
      "https://assets.store.niobium.co.nz/quote.js?siteKey=key%20value",
      "https://assets.store.niobium.co.nz/order.js?siteKey=key%20value",
      "https://assets.notification.niobium.co.nz/subscribe.js?siteKey=key%20value",
      "https://assets.notification.niobium.co.nz/contact-us.js?siteKey=key%20value",
      "https://assets.notification.niobium.co.nz/track.js?siteKey=key%20value",
      "https://assets.store.niobium.co.nz/quote.js?siteKey=plain",
    ]);
    for (const script of scripts.slice(0, 5)) {
      fireEvent.click(script);
      fireEvent.doubleClick(script);
    }
    expect(ready).toHaveBeenCalledTimes(5);
    expect(error).toHaveBeenCalledTimes(5);
  });
});
