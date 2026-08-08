import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HomeLink } from "@/components/layout/home-link";

describe("HomeLink", () => {
  it("is visible, keyboard-accessible, and clickable to the home route", async () => {
    render(<HomeLink className="home-link" />);
    const link = screen.getByRole("link", { name: "Back to home" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/");
    const clicked = vi.fn((event: MouseEvent) => event.preventDefault());
    link.addEventListener("click", clicked, { once: true });
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(clicked).toHaveBeenCalledOnce();
  });
});
