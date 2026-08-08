import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectStatus, trackEvent } = vi.hoisted(() => ({
  redirectStatus: { value: null as string | null },
  trackEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(
    redirectStatus.value === null ? "" : `redirect_status=${redirectStatus.value}`,
  ),
}));
vi.mock("@/lib/tracking", () => ({ trackEvent }));
vi.mock("next/script", () => ({
  default: ({ children, id, onError, onReady, src }: {
    children?: string;
    id?: string;
    onError?: () => void;
    onReady?: () => void;
    src?: string;
  }) => (
    <button
      data-script-body={children}
      data-script-id={id}
      data-script-src={src}
      onClick={onReady}
      onDoubleClick={onError}
      type="button"
    >
      {id ?? src}
    </button>
  ),
}));

import {
  ContactVendorScript,
  OrderVendorScript,
  QuoteVendorScript,
  SubscribeVendorScript,
  TrackingScripts,
  TrackVendorScript,
} from "@/components/integrations/third-party-scripts";
import { PreservedLink } from "@/components/navigation/preserved-link";
import { OrderStatusPanel } from "@/components/order/order-status-panel";

beforeEach(() => {
  vi.clearAllMocks();
  redirectStatus.value = null;
  window.history.replaceState({}, "", "/");
});

describe("third-party scripts", () => {
  it("renders all configured canonical analytics snippets", () => {
    const { container } = render(
      <TrackingScripts clarityId="clarity / id" googleTag="G/A" metaPixelId="meta id" />,
    );
    expect(container.querySelector('[data-script-src="https://www.googletagmanager.com/gtag/js?id=G%2FA"]')).toBeInTheDocument();
    expect(container.querySelector('[data-script-id="google-tag"]')).toHaveAttribute("data-script-body", expect.stringContaining("G/A"));
    expect(container.querySelector('[data-script-id="meta-pixel"]')).toHaveAttribute("data-script-body", expect.stringContaining("meta id"));
    expect(container.querySelector('[data-script-id="microsoft-clarity"]')).toHaveAttribute("data-script-body", expect.stringContaining("clarity / id"));
    expect(container.querySelector("noscript")).toBeInTheDocument();
  });

  it("omits analytics integrations when IDs are absent", () => {
    const { container } = render(<TrackingScripts />);
    expect(container).toBeEmptyDOMElement();
  });

  it("passes encoded site keys and lifecycle callbacks to every vendor script", async () => {
    const ready = vi.fn();
    const error = vi.fn();
    render(
      <>
        <QuoteVendorScript onError={error} onReady={ready} siteKey="site / key" />
        <OrderVendorScript onError={error} onReady={ready} siteKey="site / key" />
        <SubscribeVendorScript onError={error} onReady={ready} siteKey="site / key" />
        <ContactVendorScript onError={error} onReady={ready} siteKey="site / key" />
        <TrackVendorScript onError={error} onReady={ready} siteKey="site / key" />
      </>,
    );
    const scripts = screen.getAllByRole("button");
    expect(scripts).toHaveLength(5);
    for (const script of scripts) {
      expect(script).toHaveAttribute("data-script-src", expect.stringContaining("siteKey=site%20%2F%20key"));
      await userEvent.click(script);
      fireEvent.doubleClick(script);
    }
    expect(ready).toHaveBeenCalledTimes(5);
    expect(error).toHaveBeenCalledTimes(5);
  });
});

describe("PreservedLink", () => {
  it("leaves an in-page hash alone and runs a normal click handler without analytics", async () => {
    const click = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    render(<PreservedLink href="#details" onClick={click}>Details</PreservedLink>);
    const link = screen.getByRole("link", { name: "Details" });
    expect(link).toHaveAttribute("href", "#details");
    await userEvent.click(link);
    expect(click).toHaveBeenCalledOnce();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("combines allowed current and target query values, target hash, and optional CTA offer", async () => {
    window.history.replaceState({}, "", "/?utm_source=meta&ignored=no");
    render(
      <PreservedLink data-analytics-event="CTAClick" href="/checkout?offer=3#pay">
        Buy Now
      </PreservedLink>,
    );
    const link = screen.getByRole("link", { name: "Buy Now" });
    expect(link.getAttribute("href")).toContain("/checkout?");
    expect(link.getAttribute("href")).toContain("offer=3");
    expect(link.getAttribute("href")).toContain("utm_source=meta");
    expect(link.getAttribute("href")?.endsWith("#pay")).toBe(true);
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await userEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith("CTAClick", { offer_option: undefined });
  });
});

describe("OrderStatusPanel", () => {
  it.each([
    ["succeeded", "Your order is being processed", "PurchaseSuccess", "Track your order"],
    ["failed", "We could not complete payment", "PurchaseFailed", "Return to checkout"],
    ["processing", "We cannot confirm your order here", "PurchaseFailed", "Contact support"],
    [null, "We cannot confirm your order here", "PurchaseFailed", "Contact support"],
  ])("renders and tracks redirect status %s", (status, heading, event, link) => {
    redirectStatus.value = status;
    render(<OrderStatusPanel />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByRole("link", { name: link })).toBeVisible();
    expect(trackEvent).toHaveBeenCalledWith(event);
  });
});
