import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import offers from "@/config/offer-options.json";
import { Hero } from "@/components/sections/hero";
import {
  Faq,
  FinalCta,
  HowItWorks,
  ProblemSolution,
  ProofGallery,
  SafetyExpectations,
  TrustStrip,
  UseCases,
} from "@/components/sections/home-sections";
import { publicEnv } from "@/lib/public-env";

describe("home sections", () => {
  it("renders the hero around the supplied offer set", () => {
    render(<Hero offers={offers} />);
    expect(screen.getByRole("heading", { name: "For dogs that hate clippers" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(offers.length);
  });

  it("renders every static education, proof and conversion section", () => {
    const { container } = render(
      <>
        <TrustStrip />
        <ProblemSolution />
        <HowItWorks />
        <UseCases />
        <ProofGallery />
        <SafetyExpectations />
        <Faq />
        <FinalCta />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Replace the clipper battle" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Three steps to a calmer routine" })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getByText(new RegExp(publicEnv.contactEmail))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view returns policy/i })).toHaveAttribute("href", "/returns-policy");
    expect(screen.getByRole("link", { name: "Buy Now" })).toHaveAttribute("href", "/checkout?offer=2");
    expect(container.querySelectorAll("img")).toHaveLength(8);
  });
});
