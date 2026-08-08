import { expect, test } from "./storefront-fixture";

const subpageRoutes = [
  "/checkout?offer=1",
  "/contact",
  "/track-order",
  "/order-status",
  "/privacy-policy",
  "/terms",
  "/returns-policy",
  "/shipping-policy",
];

for (const route of subpageRoutes) {
  test(`${route} has an obvious working way back to home`, async ({ page }) => {
    await page.goto(route);

    const homeLink = page.locator('a[data-home-link="true"]').first();
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveText(/home|shop|product/i);

    const href = await homeLink.getAttribute("href");
    expect(new URL(href ?? "", page.url()).pathname).toBe("/");

    await homeLink.click();
    await expect(page).toHaveURL((url: URL) => url.pathname === "/");
  });
}
