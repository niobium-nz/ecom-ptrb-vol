import { readFile } from "node:fs/promises";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

describe("customized storefront UI primitives", () => {
  it("renders button variants and the Radix as-child path", () => {
    const { rerender } = render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("button--primary");

    rerender(
      <Button asChild fullWidth intent="accent">
        <a href="/checkout">Buy Now</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Buy Now" })).toHaveClass("button--accent", "button--full");

    rerender(<Button intent="secondary">Apply coupon</Button>);
    expect(screen.getByRole("button", { name: "Apply coupon" })).toHaveClass("button--secondary");
  });

  it("renders semantic card and badge treatments", () => {
    render(
      <Card asChild surface="proof">
        <article aria-label="Customer proof">
          <Badge tone="recommended">Most popular</Badge>
        </article>
      </Card>,
    );

    expect(screen.getByRole("article", { name: "Customer proof" })).toHaveClass("ui-card", "testimonial-card");
    expect(screen.getByText("Most popular")).toHaveClass("ui-badge", "offer-card__badge");
  });

  it("renders default card and badge surfaces", () => {
    render(
      <Card aria-label="Default card">
        <Badge>Quiet</Badge>
      </Card>,
    );
    expect(screen.getByLabelText("Default card")).toHaveClass("ui-card--base");
    expect(screen.getByText("Quiet")).toHaveClass("ui-badge--quiet");
  });

  it("renders the default card element and quiet badge defaults", () => {
    render(<Card aria-label="Base card"><Badge>Detail</Badge></Card>);
    expect(screen.getByLabelText("Base card").tagName).toBe("DIV");
    expect(screen.getByText("Detail")).toHaveClass("ui-badge--quiet");
  });

  it("is used by real purchase and proof surfaces", async () => {
    const [offers, testimonials, contact] = await Promise.all([
      readFile("components/sections/offer-selector.tsx", "utf8"),
      readFile("components/sections/testimonials.tsx", "utf8"),
      readFile("components/forms/contact-form.tsx", "utf8"),
    ]);
    expect(offers).toContain("<Badge");
    expect(testimonials).toContain("<Card");
    expect(contact).toContain("<Button");
  });
});
