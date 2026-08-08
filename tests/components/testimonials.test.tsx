import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MAX_INITIAL_TESTIMONIAL_COUNT,
  Testimonials,
  chooseInitialTestimonialCount,
  type Testimonial,
} from "../../components/sections/testimonials";

const testimonials: Testimonial[] = Array.from({ length: 10 }, (_, index) => ({
  name: `Customer ${index + 1}`,
  testimonial: `Exact supplied testimonial ${index + 1}.`,
}));

describe("chooseInitialTestimonialCount", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [3, 3],
    [6, 6],
    [7, 4],
    [9, 4],
    [10, MAX_INITIAL_TESTIMONIAL_COUNT],
    [Number.NaN, 0],
  ])("chooses an accessible initial count for %s testimonials", (total, expected) => {
    expect(chooseInitialTestimonialCount(total)).toBe(expected);
  });
});

describe("Testimonials", () => {
  it("renders every supplied testimonial after load-more actions without rewriting text", () => {
    const { container } = render(<Testimonials testimonials={testimonials} />);
    expect(container.querySelectorAll('[data-testimonial="true"]')).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: /load more testimonials/i }));

    expect(container.querySelectorAll('[data-testimonial="true"]')).toHaveLength(testimonials.length);
    expect(screen.queryByRole("button", { name: /load more testimonials/i })).not.toBeInTheDocument();
    for (const item of testimonials) {
      expect(screen.getByText(item.testimonial)).toBeInTheDocument();
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
  });

  it("shows all small sets without a load-more control", () => {
    render(<Testimonials testimonials={[
      { ...testimonials[0], city: "Sydney" },
      { ...testimonials[1], location: "Victoria" },
      { ...testimonials[2], city: null, location: null },
    ]} />);
    expect(screen.queryByRole("button", { name: /load more testimonials/i })).not.toBeInTheDocument();
    expect(screen.getByText("Customer 1").closest("p")).toHaveTextContent("Customer 1, Sydney");
    expect(screen.getByText("Customer 2").closest("p")).toHaveTextContent("Customer 2, Victoria");
    expect(screen.getByText("Customer 3")).toBeVisible();
  });

  it("renders either supplied city or location bylines without inventing one", () => {
    render(
      <Testimonials
        testimonials={[
          { name: "City customer", testimonial: "City feedback.", city: "Sydney" },
          { name: "Location customer", testimonial: "Location feedback.", location: "VIC" },
          { name: "Name only", testimonial: "No location feedback." },
        ]}
      />,
    );
    expect(screen.getByText("City customer").parentElement).toHaveTextContent("City customer, Sydney");
    expect(screen.getByText("Location customer").parentElement).toHaveTextContent("Location customer, VIC");
    expect(screen.getByText("Name only").parentElement).toHaveTextContent("Name only");
  });
});
