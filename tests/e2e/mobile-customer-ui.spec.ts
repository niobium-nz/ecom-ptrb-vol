import { readFileSync } from "node:fs";

import { expect, test } from "./storefront-fixture";

const testimonials = JSON.parse(
  readFileSync(new URL("../../config/testimonials.json", import.meta.url), "utf8"),
) as Array<{ name: string; testimonial: string }>;

const routes = [
  "/",
  "/checkout?offer=1",
  "/contact",
  "/track-order",
  "/order-status",
  "/privacy-policy",
  "/terms",
  "/returns-policy",
  "/shipping-policy",
];

const mobileViewports = [
  { name: "small-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "iphone-390", width: 390, height: 844 },
  { name: "large-phone-430", width: 430, height: 932 },
];

const forbiddenCustomerPhrases = [
  /\u2014/,
  /\ba focused,?\s+guest checkout\b/i,
  /\bguest checkout\b/i,
  /\bconversion[- ]focused\b/i,
  /\blow[- ]friction\b|\breduce friction\b/i,
  /\boffer stack\b|\bmessage match(?:ed)?\b|\bpurchase flow\b/i,
  /\bwebsite owner\b|\bsite owner\b|\bbusiness operator\b/i,
  /\bactive coupon\b/i,
];

for (const viewport of mobileViewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`${route} is readable at ${viewport.width}px`, async ({ page }) => {
        await page.goto(route);

        const metrics = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const headingLimits: Record<string, number> = width <= 360
            ? { H1: 36, H2: 32, H3: 28 }
            : { H1: 40, H2: 36, H3: 32 };
          const headingDefects = [...document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,[role=heading],[data-headline=true]")]
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().height > 0;
            })
            .flatMap((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              const fontSize = Number.parseFloat(style.fontSize);
              const parsedLineHeight = Number.parseFloat(style.lineHeight);
              const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
              const range = document.createRange();
              range.selectNodeContents(element);
              const lineTops = [...range.getClientRects()]
                .filter((lineRect) => lineRect.width > 0 && lineRect.height > 0)
                .map((lineRect) => Math.round(lineRect.top))
                .sort((left, right) => left - right)
                .filter((top, index, values) => index === 0 || Math.abs(top - values[index - 1]) > 2);
              const lineCount = lineTops.length || Math.max(1, Math.round(rect.height / lineHeight));
              const text = element.innerText.trim().replace(/\s+/g, " ");
              const wordCount = text ? text.split(" ").length : 0;
              const defects: string[] = [];
              const semanticLevel = element.tagName.match(/^H[1-6]$/)?.[0]
                ?? (element.getAttribute("aria-level") ? `H${element.getAttribute("aria-level")}` : "H2");
              const limit = headingLimits[semanticLevel] ?? headingLimits.H3;
              if (fontSize > limit + 0.5) defects.push(`${semanticLevel} ${JSON.stringify(text)} is ${fontSize}px`);
              if (wordCount <= 6 && text.length <= 42 && lineCount > 2) defects.push(`${element.tagName} ${JSON.stringify(text)} spans ${lineCount} lines`);
              return defects;
            });

          const interactionDefects = [...document.querySelectorAll<HTMLElement>('button,input:not([type="checkbox"]):not([type="radio"]),select,textarea,[data-primary-action="true"]')]
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().height > 0;
            })
            .flatMap((element) => {
              const rect = element.getBoundingClientRect();
              return rect.height < 44 || rect.width < 44
                ? [`${element.tagName} target is ${Math.round(rect.width)}x${Math.round(rect.height)}px`]
                : [];
            });

          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: width,
            bodyText: document.body.innerText,
            headingDefects,
            interactionDefects,
          };
        });

        expect(metrics.documentWidth, `horizontal overflow on ${route}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.headingDefects).toEqual([]);
        expect(metrics.interactionDefects).toEqual([]);
        for (const pattern of forbiddenCustomerPhrases) expect(metrics.bodyText).not.toMatch(pattern);
      });
    }
  });
}

test("home page visibly renders supplied customer feedback", async ({ page }) => {
  await page.goto("/");
  const section = page.locator('[data-testimonials="true"]');
  await expect(section).toBeVisible();
  expect(await section.locator('[data-testimonial="true"]').count()).toBeGreaterThanOrEqual(3);
});

test("applied coupon wording is explicit", async ({ page }) => {
  await page.goto("/checkout?offer=1&coupon=TESTCODE");
  const label = page.locator('[data-coupon-applied="true"]');
  await expect(label).toBeVisible();
  await expect(label).toContainText("Coupon applied to this order");
  await expect(page.getByText(/active coupon/i)).toHaveCount(0);
});

test("home page loads every supplied testimonial in exact order", async ({ page }) => {
  const testimonialCount = testimonials.length;
  await page.goto("/");
  const section = page.locator('[data-testimonials="true"]');
  await expect(section).toHaveAttribute("data-testimonials-total", String(testimonialCount));
  const initialExpected = testimonialCount <= 6 ? testimonialCount : testimonialCount <= 9 ? 4 : 6;
  await expect(section.locator('[data-testimonial="true"]')).toHaveCount(initialExpected);
  const loadMore = section.locator('[data-load-more-testimonials="true"]');
  while (await loadMore.count()) await loadMore.click();
  await expect(section.locator('[data-testimonial="true"]')).toHaveCount(testimonialCount);
  for (const testimonial of testimonials) {
    await expect(section.getByText(testimonial.name, { exact: true })).toBeVisible();
    await expect(section.getByText(testimonial.testimonial, { exact: true })).toBeVisible();
  }
});

test("checkout shows order information before forms and keeps coupon compact", async ({ page }) => {
  await page.goto("/checkout?offer=1&coupon=TESTCODE");
  const summary = page.locator('[data-checkout-order-summary="true"]');
  const coupon = summary.locator('[data-checkout-coupon="true"]');
  const shipping = page.locator('[data-checkout-shipping-form="true"]');
  const payment = page.locator('[data-checkout-payment="true"]');
  await expect(summary).toBeVisible();
  await expect(coupon).toBeVisible();
  await expect(coupon.locator('[data-coupon-toggle="true"]')).toBeVisible();
  const summaryBox = await summary.boundingBox();
  const shippingBox = await shipping.boundingBox();
  const paymentBox = await payment.boundingBox();
  expect(summaryBox?.y).toBeLessThan(shippingBox?.y ?? Number.POSITIVE_INFINITY);
  expect(summaryBox?.y).toBeLessThan(paymentBox?.y ?? Number.POSITIVE_INFINITY);
});
