# Shared decision record

## Input and environment

- Source brief: `43259921-cfcd-4a25-8ff1-1adc0bdcd28d.json` (generation input only; no external path is retained in the shipped project).
- Recursive object-key validation: every input key passes `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`.
- Product slug: `ptrb-vol`.
- Target country: `AU`; checkout never renders a country selector.
- Shipping option: input integer `1`; public config parses the decimal environment value into a JavaScript number.
- App names: `niobiumecomm-ptrb-vol-dev`, `niobiumecomm-ptrb-vol-test`, and `niobiumecomm-ptrb-vol`.
- Store endpoint is the final argument for quote, order, and tracking calls. Notification endpoint is the final argument for subscription and contact calls.
- Vendor methods return raw `Promise<Response>` values. One shared helper performs network, Response-shape, exactly-once JSON, HTTP status, and body validation before data reaches UI code.

## Offers and pricing

- Visible order is the input mapping order: `1`, `2`, `3`.
- Recommended selection is option `2` only.
- Generated vendor values:
  - `OFFER_OPTION__1=[{"Listing":1,"Option":"Default","Quantity":1}]`
  - `OFFER_OPTION__2=[{"Listing":1,"Option":"Default","Quantity":2},{"Listing":2,"Option":"Default","Quantity":4}]`
  - `OFFER_OPTION__3=[{"Listing":1,"Option":"Default","Quantity":3}]`
- First-render prices use the required input defaults: AUD 24.95, 39.95, and 54.95. Background quotes replace individual prices only after valid 2xx JSON responses.
- Checkout, Stripe, order totals, and purchase analytics use validated live quote cents only.
- The brief also contains older A$64.95/A$99.95/A$129.95 narrative figures and savings copy that conflict with the structured defaults. Truthfulness and the binding structured-price contract take priority, so those savings claims are not rendered.

## Customer experience and art direction

- Message anchor: `For dogs that hate clippers` with a reward-led, supervised, gradual front-nail routine.
- Art direction: tactile proof-led editorial DTC. Calm teal anchors actions, warm sand is the canvas, and treat orange marks the recommended option and useful cues.
- System fonts only.
- Hero asset: `hero_image_01.png`, eager with explicit dimensions. Below-fold supplied images are lazy-loaded.
- Shipping copy is origin-neutral: tracked delivery to Australia, 7 - 14 business days, with tracking emailed after dispatch.
- No unsupported guarantee or medical/performance claim is added. Returns are linked to the byte-exact policy.
- Every supplied testimonial remains byte-for-byte equivalent in `config/testimonials.json`, in order. Six render initially, with accessible load-more batches.

## Brand and legal content

- Source SVG is copied to `source-assets/logo.svg`, validated as a black/default-black foreground plus white background source, and used only to generate transparent PNG variants.
- Primary PNG foreground: `#1F6E6E`; inverse PNG foreground: `#F7F3EA`. White source pixels become transparent.
- All 22 supplied product assets are copied into `public/assets/` with project-local paths.
- Four policy sources are copied byte-for-byte into `content/policies/` and bound to their route-specific SHA-256 entries in `config/legal-content-manifest.json`.

## Routes and quality

- Routes: `/`, `/checkout`, `/contact`, `/track-order`, `/order-status`, `/privacy-policy`, `/terms`, `/returns-policy`, `/shipping-policy`.
- Every non-home route uses the shared visible `Back to home` text link.
- Static App Router export only. No cart, API route, server action, middleware, countdown, wishlist, or external checkout handoff.
- Quality gate includes dependency freshness/health, install-script review, boundary audit, zero-warning lint, typecheck, V8 coverage, build, rendered-content audit, Playwright, and warning-free dev runtime.
