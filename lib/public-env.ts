import { rawPublicEnv } from "./generated/public-env";
import {
  readIntegrationEndpoints,
  readRequiredStringEnv,
  readShippingOptionId,
} from "./env";

const integrationEndpoints = readIntegrationEndpoints(rawPublicEnv);

export const publicEnv = Object.freeze({
  appName: readRequiredStringEnv("APP_NAME", rawPublicEnv.APP_NAME),
  tenantId: readRequiredStringEnv("TENANT_ID", rawPublicEnv.TENANT_ID),
  googleRecaptchaSiteKey: readRequiredStringEnv(
    "GOOGLE_RECAPTCHA_SITE_KEY",
    rawPublicEnv.GOOGLE_RECAPTCHA_SITE_KEY,
  ),
  storeIntegrationEndpoint: integrationEndpoints.storeIntegrationEndpoint,
  notificationIntegrationEndpoint: integrationEndpoints.notificationIntegrationEndpoint,
  stripePublicKey: readRequiredStringEnv("STRIPE_PUBLIC_KEY", rawPublicEnv.STRIPE_PUBLIC_KEY),
  shippingOptionId: readShippingOptionId(rawPublicEnv.SHIPPING_OPTION_ID),
  targetCountry: readRequiredStringEnv("TARGET_COUNTRY", rawPublicEnv.TARGET_COUNTRY),
  fallbackCoupon: readRequiredStringEnv("FALLBACK_COUPON", rawPublicEnv.FALLBACK_COUPON),
  offerOptions: Object.freeze({
    "1": readRequiredStringEnv("OFFER_OPTION__1", rawPublicEnv.OFFER_OPTION__1),
    "2": readRequiredStringEnv("OFFER_OPTION__2", rawPublicEnv.OFFER_OPTION__2),
    "3": readRequiredStringEnv("OFFER_OPTION__3", rawPublicEnv.OFFER_OPTION__3),
  }),
  metaPixelId: readRequiredStringEnv("META_PIXEL_ID", rawPublicEnv.META_PIXEL_ID),
  googleTag: readRequiredStringEnv("GOOGLE_TAG", rawPublicEnv.GOOGLE_TAG),
  clarityId: readRequiredStringEnv("CLARITY_ID", rawPublicEnv.CLARITY_ID),
  facebookUrl: readRequiredStringEnv("FACEBOOK_URL", rawPublicEnv.FACEBOOK_URL),
  instagramUrl: readRequiredStringEnv("INSTAGRAM_URL", rawPublicEnv.INSTAGRAM_URL),
  contactEmail: readRequiredStringEnv("CONTACT_EMAIL", rawPublicEnv.CONTACT_EMAIL),
});
