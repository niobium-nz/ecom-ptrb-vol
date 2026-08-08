import Image from "next/image";

import type { OfferOption } from "@/components/sections/offer-selector";
import { OfferSelector } from "@/components/sections/offer-selector";

export function Hero({ offers }: { offers: readonly OfferOption[] }) {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__media-wrap">
        <Image
          alt="A dog scratching the PawTrim Reward Board while its owner offers a treat"
          className="hero__media"
          fetchPriority="high"
          height="1254"
          loading="eager"
          sizes="(min-width: 900px) 55vw, 100vw"
          src="/assets/hero_image_01.png"
          width="1254"
        />
        <div className="hero__proof-note">
          <span className="hero__proof-dot" aria-hidden="true" />
          Reward-led front-nail care
        </div>
      </div>

      <div className="hero__content">
        <p className="eyebrow">PawTrim Reward Board</p>
        <h1 id="hero-heading">For dogs that hate clippers</h1>
        <p className="hero__lead">
          Turn front-nail upkeep into a short, reward-led scratch routine without
          holding a paw still for a direct clip.
        </p>

        <ul className="check-list" aria-label="Key benefits">
          <li>Your dog participates for treats</li>
          <li>Scratching files front nails gradually</li>
          <li>Designed for short, supervised sessions</li>
        </ul>

        <OfferSelector offers={offers} />
      </div>
    </section>
  );
}
