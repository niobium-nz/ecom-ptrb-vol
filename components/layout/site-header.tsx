import { SiteLogo } from "@/components/brand/site-logo";
import { PreservedLink } from "@/components/navigation/preserved-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <PreservedLink aria-label="Niobium Studio home" className="site-header__brand" href="/">
          <SiteLogo eager placement="header" variant="primary" />
        </PreservedLink>
        <PreservedLink className="site-header__link" href="/track-order">
          Track order
        </PreservedLink>
      </div>
    </header>
  );
}
