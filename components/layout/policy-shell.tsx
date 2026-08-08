import type { ReactNode } from "react";

import { SiteLogo } from "@/components/brand/site-logo";
import { HomeLink } from "@/components/layout/home-link";

export function PolicyShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="subpage-shell">
      <div className="subpage-topline">
        <SiteLogo />
        <HomeLink className="home-link" />
      </div>
      <article className="policy-card">
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  );
}
