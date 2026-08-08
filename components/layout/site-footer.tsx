import { SiteLogo } from "@/components/brand/site-logo";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { PreservedLink } from "@/components/navigation/preserved-link";
import { publicEnv } from "@/lib/public-env";

const customerLinks = [
  ["Contact", "/contact"],
  ["Track order", "/track-order"],
  ["Shipping", "/shipping-policy"],
  ["Returns", "/returns-policy"],
];

const policyLinks = [
  ["Privacy", "/privacy-policy"],
  ["Terms", "/terms"],
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <PreservedLink aria-label="Niobium Studio home" href="/">
            <SiteLogo placement="footer" variant="inverse" />
          </PreservedLink>
          <p>Pet essentials, treats and toys for happy paws across Australia and New Zealand.</p>
          <a className="site-footer__email" href={`mailto:${publicEnv.contactEmail}`}>
            {publicEnv.contactEmail}
          </a>
        </div>

        <nav aria-label="Customer care" className="site-footer__nav">
          <p>Customer care</p>
          {customerLinks.map(([label, href]) => (
            <PreservedLink href={href} key={href}>
              {label}
            </PreservedLink>
          ))}
        </nav>

        <nav aria-label="Policies" className="site-footer__nav">
          <p>Policies</p>
          {policyLinks.map(([label, href]) => (
            <PreservedLink href={href} key={href}>
              {label}
            </PreservedLink>
          ))}
        </nav>

        <div className="site-footer__social">
          <p>Follow along</p>
          <a
            href={publicEnv.instagramUrl}
            rel="noreferrer"
            target="_blank"
          >
            Instagram
          </a>
          <a
            href={publicEnv.facebookUrl}
            rel="noreferrer"
            target="_blank"
          >
            Facebook
          </a>
        </div>

        <SubscriptionForm />
      </div>
      <div className="site-footer__legal">
        <span>© {new Date().getFullYear()} Niobium Studio</span>
        <span>Secure in-site checkout</span>
      </div>
    </footer>
  );
}
