"use client";

import Script from "next/script";

const quoteScript = "https://assets.store.niobium.co.nz/quote.js";
const orderScript = "https://assets.store.niobium.co.nz/order.js";
const subscribeScript = "https://assets.notification.niobium.co.nz/subscribe.js";
const contactScript = "https://assets.notification.niobium.co.nz/contact-us.js";
const trackScript = "https://assets.store.niobium.co.nz/track.js";

function withSiteKey(src: string, siteKey: string): string {
  return `${src}?siteKey=${encodeURIComponent(siteKey)}`;
}

export function TrackingScripts({
  metaPixelId,
  googleTag,
  clarityId,
}: {
  metaPixelId?: string;
  googleTag?: string;
  clarityId?: string;
}) {
  return (
    <>
      {googleTag ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTag)}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(googleTag)});`}
          </Script>
        </>
      ) : null}
      {metaPixelId ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(metaPixelId)});
fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element -- Canonical Meta Pixel noscript beacon. */}
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(metaPixelId)}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
      {clarityId ? (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(clarityId)});`}
        </Script>
      ) : null}
    </>
  );
}

type VendorScriptProps = {
  siteKey: string;
  onReady?: () => void;
  onError?: () => void;
};

export function QuoteVendorScript({ siteKey, onReady, onError }: VendorScriptProps) {
  return (
    <Script
      onError={onError}
      onReady={onReady}
      src={withSiteKey(quoteScript, siteKey)}
      strategy="afterInteractive"
    />
  );
}

export function OrderVendorScript({ siteKey, onReady, onError }: VendorScriptProps) {
  return (
    <Script
      onError={onError}
      onReady={onReady}
      src={withSiteKey(orderScript, siteKey)}
      strategy="afterInteractive"
    />
  );
}

export function SubscribeVendorScript({ siteKey, onReady, onError }: VendorScriptProps) {
  return (
    <Script
      onError={onError}
      onReady={onReady}
      src={withSiteKey(subscribeScript, siteKey)}
      strategy="afterInteractive"
    />
  );
}

export function ContactVendorScript({ siteKey, onReady, onError }: VendorScriptProps) {
  return (
    <Script
      onError={onError}
      onReady={onReady}
      src={withSiteKey(contactScript, siteKey)}
      strategy="afterInteractive"
    />
  );
}

export function TrackVendorScript({ siteKey, onReady, onError }: VendorScriptProps) {
  return (
    <Script
      onError={onError}
      onReady={onReady}
      src={withSiteKey(trackScript, siteKey)}
      strategy="afterInteractive"
    />
  );
}
