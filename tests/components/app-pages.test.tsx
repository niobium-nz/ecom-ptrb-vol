import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/checkout/checkout-flow", () => ({
  CheckoutFlow: () => <div>checkout flow</div>,
}));
vi.mock("@/components/forms/contact-form", () => ({
  ContactForm: () => <div>contact form</div>,
}));
vi.mock("@/components/forms/subscription-form", () => ({
  SubscriptionForm: () => <div>subscription form</div>,
}));
vi.mock("@/components/forms/track-order-form", () => ({
  TrackOrderForm: () => <div>track order form</div>,
}));
vi.mock("@/components/order/order-status-panel", () => ({
  OrderStatusPanel: () => <div>order status panel</div>,
}));
vi.mock("@/components/integrations/third-party-scripts", () => ({
  TrackingScripts: () => <div>tracking scripts</div>,
}));
vi.mock("@/components/sections/offer-selector", () => ({
  OfferSelector: ({ offers }: { offers: unknown }) => (
    <div data-shopper-offers={JSON.stringify(offers)}>offer selector</div>
  ),
}));
vi.mock("@/lib/legal-content", () => ({
  readPolicySource: (key: string) => `Exact ${key} source`,
}));

import CheckoutPage from "@/app/checkout/page";
import ContactPage from "@/app/contact/page";
import RootLayout from "@/app/layout";
import NotFound from "@/app/not-found";
import OrderStatusPage from "@/app/order-status/page";
import HomePage from "@/app/page";
import PrivacyPolicyPage from "@/app/privacy-policy/page";
import ReturnsPolicyPage from "@/app/returns-policy/page";
import ShippingPolicyPage from "@/app/shipping-policy/page";
import TermsPage from "@/app/terms/page";
import TrackOrderPage from "@/app/track-order/page";

describe("App Router pages", () => {
  it("renders the root layout and complete home page", () => {
    const { container } = render(<RootLayout><HomePage /></RootLayout>);
    expect(container.querySelector("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "For dogs that hate clippers" })).toBeVisible();
    expect(screen.getByText("tracking scripts")).toBeInTheDocument();
    expect(screen.getByText("subscription form")).toBeInTheDocument();
    const serializedOffers = screen.getByText("offer selector").getAttribute("data-shopper-offers") ?? "";
    expect(serializedOffers).not.toContain("description");
    expect(serializedOffers).not.toContain("option_configuration");
    expect(serializedOffers).not.toContain("low-friction testing");
  });

  it.each([
    ["checkout", <CheckoutPage key="checkout" />, "Complete your order", "checkout flow"],
    ["contact", <ContactPage key="contact" />, "How can we help?", "contact form"],
    ["order status", <OrderStatusPage key="order-status" />, "Back to home", "order status panel"],
    ["track order", <TrackOrderPage key="track-order" />, "Track your order", "track order form"],
  ])("renders the %s route", (_name, page, heading, child) => {
    render(page);
    expect(screen.getByText(heading)).toBeVisible();
    expect(screen.getByText(child)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it.each([
    ["privacy_policy", <PrivacyPolicyPage key="privacy" />, "Privacy policy"],
    ["returns_policy", <ReturnsPolicyPage key="returns" />, "Returns policy"],
    ["shipping_policy", <ShippingPolicyPage key="shipping" />, "Shipping policy"],
    ["terms", <TermsPage key="terms" />, "Terms"],
  ])("binds the %s policy route", (key, page, title) => {
    const { container } = render(page);
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(container.querySelector("[data-policy-source]")).toHaveTextContent(`Exact ${key} source`);
  });

  it("renders the not-found return path and shared policy shell", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Back to home" })).toHaveLength(2);
  });
});
