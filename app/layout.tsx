import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./commerce.css";

import { TrackingScripts } from "@/components/integrations/third-party-scripts";
import { publicEnv } from "@/lib/public-env";

export const metadata: Metadata = {
  title: "PawTrim Reward Board | Niobium Studio",
  description: "A reward-led scratch routine for gradual front-nail maintenance.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en-AU">
      <body>
        {children}
        <TrackingScripts
          clarityId={publicEnv.clarityId}
          googleTag={publicEnv.googleTag}
          metaPixelId={publicEnv.metaPixelId}
        />
      </body>
    </html>
  );
}
