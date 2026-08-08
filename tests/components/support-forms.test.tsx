import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendContactMessage, subscribeToUpdates, trackOrder } = vi.hoisted(() => ({
  sendContactMessage: vi.fn(),
  subscribeToUpdates: vi.fn(),
  trackOrder: vi.fn(),
}));

vi.mock("@/lib/support", () => ({
  sendContactMessage,
  subscribeToUpdates,
  trackOrder,
}));

vi.mock("@/components/integrations/third-party-scripts", () => ({
  ContactVendorScript: ({ onError }: { onError?: () => void }) => (
    <button onClick={onError} type="button">fail contact script</button>
  ),
  SubscribeVendorScript: () => <span>subscribe script</span>,
  TrackVendorScript: ({ onError }: { onError?: () => void }) => (
    <button onClick={onError} type="button">fail tracking script</button>
  ),
}));

import { ContactForm } from "@/components/forms/contact-form";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { TrackOrderForm } from "@/components/forms/track-order-form";
import { publicEnv } from "@/lib/public-env";

beforeEach(() => {
  sendContactMessage.mockReset();
  subscribeToUpdates.mockReset();
  trackOrder.mockReset();
});

function fillContact(name = "Pat", email = "pat@example.com", message = "Please help") {
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/How can we help/), { target: { value: message } });
}

describe("ContactForm", () => {
  it.each(["name", "email", "message"])("treats a missing %s control as empty", (control) => {
    const { container } = render(<ContactForm />);
    container.querySelector(`[name="${control}"]`)?.remove();
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("Enter your name, a valid email address and your message.")).toBeVisible();
  });

  it("validates all fields and exposes the env-derived script fallback", async () => {
    render(<ContactForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Send message" }).closest("form")!);
    expect(screen.getByText("Enter your name, a valid email address and your message.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "fail contact script" }));
    expect(screen.getByText(`The contact form could not load. Please email ${publicEnv.contactEmail}.`)).toBeVisible();
  });

  it("submits once while pending and resets after success", async () => {
    let resolve!: () => void;
    sendContactMessage.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    render(<ContactForm />);
    fillContact();
    const form = screen.getByRole("button", { name: "Send message" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(sendContactMessage).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    resolve();
    await screen.findByText(/message has been sent/);
    expect(screen.getByLabelText(/Name/)).toHaveValue("");
  });

  it.each([
    [new Error("Safe contact error"), "Safe contact error"],
    ["bad rejection", "We could not send your message. Please try again."],
  ])("shows a safe submission failure", async (reason, expected) => {
    sendContactMessage.mockRejectedValueOnce(reason);
    render(<ContactForm />);
    fillContact();
    fireEvent.submit(screen.getByRole("button", { name: "Send message" }).closest("form")!);
    expect(await screen.findByText(expected)).toBeVisible();
  });
});

describe("SubscriptionForm", () => {
  it("treats a missing email control as empty", () => {
    const { container } = render(<SubscriptionForm />);
    container.querySelector('[name="subscription-email"]')?.remove();
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
  });

  it("validates an email before calling the vendor", () => {
    render(<SubscriptionForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "invalid" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign up" }).closest("form")!);
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(subscribeToUpdates).not.toHaveBeenCalled();
  });

  it("submits once while pending and locks the successful form", async () => {
    let resolve!: () => void;
    subscribeToUpdates.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    render(<SubscriptionForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "pat@example.com" } });
    const form = screen.getByRole("button", { name: "Sign up" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(subscribeToUpdates).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Signing up..." })).toBeDisabled();
    resolve();
    expect(await screen.findByRole("button", { name: "Signed up" })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toHaveValue("");
  });

  it.each([
    [new Error("Safe subscription error"), "Safe subscription error"],
    [null, "We could not complete your subscription. Please try again."],
  ])("shows a safe subscription failure", async (reason, expected) => {
    subscribeToUpdates.mockRejectedValueOnce(reason);
    render(<SubscriptionForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "pat@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign up" }).closest("form")!);
    expect(await screen.findByText(expected)).toBeVisible();
  });
});

const trackedOrder = {
  status: 20,
  shippingStatus: 3,
  shippingCity: "Sydney",
  shippingState: "NSW",
  shippingCountry: "AU",
  created: "2026-08-07",
  cart: [{ listing: 1, option: "Default", quantity: 2, name: "PawTrim Reward Board" }],
};

function fillTrackingEmail(value = "pat@example.com") {
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value } });
}

describe("TrackOrderForm", () => {
  it("treats missing lookup controls as empty and supports switching back to order lookup", async () => {
    const { container, unmount: unmountEmail } = render(<TrackOrderForm />);
    container.querySelector('[name="email"]')?.remove();
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    unmountEmail();

    const { container: orderContainer, unmount } = render(<TrackOrderForm />);
    orderContainer.querySelector('[name="order"]')?.remove();
    fillTrackingEmail();
    fireEvent.submit(orderContainer.querySelector("form")!);
    expect(screen.getByText("Enter your numeric order number without a leading zero.")).toBeVisible();
    unmount();

    const { container: nameContainer } = render(<TrackOrderForm />);
    await userEvent.click(screen.getByRole("radio", { name: "First name" }));
    nameContainer.querySelector('[name="firstName"]')?.remove();
    fillTrackingEmail();
    fireEvent.submit(nameContainer.querySelector("form")!);
    expect(screen.getByText("Enter the first name used for the order.")).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Order number" }));
    expect(screen.getByRole("radio", { name: "Order number" })).toBeChecked();
  });

  it("validates email, order number and first name", async () => {
    render(<TrackOrderForm />);
    const form = screen.getByRole("button", { name: "Track order" }).closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    fillTrackingEmail();
    fireEvent.change(screen.getByRole("textbox", { name: /Order number.*Required/ }), { target: { value: "01" } });
    fireEvent.submit(form);
    expect(screen.getByText("Enter your numeric order number without a leading zero.")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: /Order number.*Required/ }), { target: { value: "999999999999999999999999" } });
    fireEvent.submit(form);
    expect(trackOrder).not.toHaveBeenCalled();

  });

  it("requires a first name for name lookup", async () => {
    render(<TrackOrderForm />);
    fillTrackingEmail();
    await userEvent.click(screen.getByRole("radio", { name: "First name" }));
    fireEvent.submit(screen.getByRole("button", { name: "Track order" }).closest("form")!);
    expect(screen.getByText("Enter the first name used for the order.")).toBeVisible();
  });

  it("looks up by order number once while loading and renders known statuses", async () => {
    let resolve!: (value: typeof trackedOrder) => void;
    trackOrder.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<TrackOrderForm />);
    fillTrackingEmail();
    fireEvent.change(screen.getByRole("textbox", { name: /Order number.*Required/ }), { target: { value: "42" } });
    const form = screen.getByRole("button", { name: "Track order" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(trackOrder).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Finding your order..." })).toBeDisabled();
    resolve(trackedOrder);
    const result = await screen.findByRole("heading", { name: "Shipped" });
    const section = result.closest("section")!;
    expect(within(section).getByText("Paid")).toBeVisible();
    expect(within(section).getByText("Sydney, NSW, AU")).toBeVisible();
    expect(within(section).getByText("PawTrim Reward Board")).toBeVisible();
    expect(trackOrder).toHaveBeenCalledWith(expect.any(Object), { email: "pat@example.com", order: 42 });
  });

  it("looks up a normalized first name and renders unknown fallbacks", async () => {
    trackOrder.mockResolvedValueOnce({
      ...trackedOrder,
      status: 999,
      shippingStatus: 999,
      shippingCity: "",
      shippingState: "",
      shippingCountry: "AU",
      cart: [{ listing: 8, option: "", quantity: 1, name: "  " }],
    });
    render(<TrackOrderForm />);
    await userEvent.click(screen.getByRole("radio", { name: "First name" }));
    fillTrackingEmail();
    fireEvent.change(screen.getByRole("textbox", { name: /First name.*Required/ }), { target: { value: "  PAT  " } });
    fireEvent.submit(screen.getByRole("button", { name: "Track order" }).closest("form")!);
    expect(await screen.findByRole("heading", { name: "Order found" })).toBeVisible();
    expect(screen.getAllByText("Status update available")).toHaveLength(2);
    expect(screen.getByText("AU")).toBeVisible();
    expect(screen.getByText("Item 8")).toBeVisible();
    expect(trackOrder).toHaveBeenCalledWith(expect.any(Object), { email: "pat@example.com", firstName: "pat" });
  });

  it.each([
    [new Error("Safe tracking error"), "Safe tracking error"],
    [false, "We could not retrieve tracking details. Please try again."],
  ])("shows safe tracking failures", async (reason, expected) => {
    trackOrder.mockRejectedValueOnce(reason);
    render(<TrackOrderForm />);
    fillTrackingEmail();
    fireEvent.change(screen.getByRole("textbox", { name: /Order number.*Required/ }), { target: { value: "42" } });
    fireEvent.submit(screen.getByRole("button", { name: "Track order" }).closest("form")!);
    expect(await screen.findByText(expected)).toBeVisible();
  });

  it("shows a safe error when the vendor script fails", async () => {
    render(<TrackOrderForm />);
    await userEvent.click(screen.getByRole("button", { name: "fail tracking script" }));
    expect(screen.getByText("Order tracking could not load. Please check your connection and try again.")).toBeVisible();
  });
});
