import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteLogo } from "@/components/brand/site-logo";

describe("SiteLogo", () => {
  it("renders the primary generated PNG with header defaults", () => {
    const { getByAltText } = render(<SiteLogo />);

    const logo = getByAltText("Niobium Studio");
    expect(logo).toHaveAttribute("src", "/assets/logo-primary.png");
    expect(logo).toHaveAttribute("width", "95");
    expect(logo).toHaveAttribute("height", "80");
    expect(logo).toHaveAttribute("loading", "lazy");
    expect(logo).toHaveClass("h-8", "sm:h-9", "w-auto", "object-contain");
  });

  it("renders the eager inverse footer treatment and accepts a layout class", () => {
    const { getByAltText } = render(<SiteLogo variant="inverse" placement="footer" eager className="mx-auto" />);

    const logo = getByAltText("Niobium Studio");
    expect(logo).toHaveAttribute("src", "/assets/logo-inverse.png");
    expect(logo).toHaveAttribute("loading", "eager");
    expect(logo).toHaveClass("h-10", "mx-auto");
  });
});
