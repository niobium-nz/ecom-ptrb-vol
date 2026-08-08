import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PreservedLink,
  getCurrentSearch,
  getServerSearch,
  subscribeToLocationChange,
  withPreservedQuery,
} from "@/components/navigation/preserved-link";

describe("PreservedLink branches", () => {
  it("preserves hash-only links and exposes browser/server snapshots", () => {
    window.history.replaceState({}, "", "/?utm_source=meta");
    expect(withPreservedQuery("#details", window.location.search)).toBe("#details");
    expect(getCurrentSearch()).toBe("?utm_source=meta");
    expect(getServerSearch()).toBe("");
  });

  it("subscribes and unsubscribes from location changes", () => {
    const handler = vi.fn();
    const remove = subscribeToLocationChange(handler);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(handler).toHaveBeenCalledOnce();
    remove();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("runs an ordinary click handler without emitting purchase analytics", () => {
    const onClick = vi.fn((event) => event.preventDefault());
    window.gtag = vi.fn();
    render(<PreservedLink href="/contact" onClick={onClick}>Contact</PreservedLink>);
    fireEvent.click(screen.getByRole("link", { name: "Contact" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(window.gtag).not.toHaveBeenCalled();
    delete window.gtag;
  });
});
