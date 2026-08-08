# PawTrim Reward Board storefront

Static-export Next.js storefront for the PawTrim Reward Board. Runtime commerce integrations execute in the browser; the generated `out/` directory is deployed to Cloudflare Pages.

## Local commands

```bash
npm ci --strict-allow-scripts
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run build` prepares offer environment values, regenerates the transparent logo assets and browser-safe public configuration, then writes the static export to `out/`. Run `npm run quality` for the complete dependency, boundary, lint, type, coverage, build, rendered-content, E2E, and development-runtime gate.

## Application names and deployment

- Local development: `niobiumecomm-ptrb-vol-dev`
- Shared test project: `niobiumecomm-ptrb-vol-test`
- Production project: `niobiumecomm-ptrb-vol`

The non-main workflow validates and deploys through the GitHub Environment named `test`. Main pull requests validate without deployment. Main pushes and manual production runs validate first, then deploy through the GitHub Environment named `prod`.

`npm run deploy` requires an existing `out/` directory. It creates the Pages project when absent, deploys with the locally installed Wrangler, creates or updates the CNAME record, and registers `<APP_NAME>.listings.niobium.co.nz` as the custom Pages domain.

## Environment

Browser-safe build variables:

```text
APP_NAME
TENANT_ID
GOOGLE_RECAPTCHA_SITE_KEY
STORE_INTEGRATION_ENDPOINT
NOTIFICATION_INTEGRATION_ENDPOINT
STRIPE_PUBLIC_KEY
SHIPPING_OPTION_ID
TARGET_COUNTRY
FALLBACK_COUPON
OFFER_OPTION__1
OFFER_OPTION__2
OFFER_OPTION__3
META_PIXEL_ID
GOOGLE_TAG
CLARITY_ID
FACEBOOK_URL
INSTAGRAM_URL
CONTACT_EMAIL
```

`scripts/export-offer-env.mjs` derives the three `OFFER_OPTION__n` values from `config/offer-options.json` in mapping order. Locally it updates only those keys in `.env.generated`; in GitHub Actions it appends them to `$GITHUB_ENV`.

Deploy-only secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The deploy-only values are passed directly to deployment tooling. They are excluded from the generated public environment module and static output. `DEV_ALLOWED_ORIGINS` is optional local configuration and is likewise not exposed publicly.

## Routes

- `/`
- `/checkout`
- `/contact`
- `/track-order`
- `/order-status`
- `/privacy-policy`
- `/terms`
- `/returns-policy`
- `/shipping-policy`

There is no cart or server API route. Checkout is an in-site, browser-side flow.

## Offer mapping

Offer order is `1`, `2`, `3`, with offer `2` recommended. The build converts each lower-snake-case `option_configuration` item into the vendor keys `Listing`, `Option`, and `Quantity`; it never sorts the mapping.

## Assets and legal content

- `source-assets/logo.svg` is the copied source brand mark used only by the logo preparation script.
- `public/assets/logo-primary.png` and `public/assets/logo-inverse.png` are verified transparent generated variants used by the site.
- The 22 supplied product and campaign images are copied into `public/assets/` and referenced only through project-local paths.
- The supplied legal sources are byte-copied into `content/policies/`; `config/legal-content-manifest.json` binds each policy route to its recorded digest.

No generated source, configuration, test, or task depends on the original input filesystem location.
