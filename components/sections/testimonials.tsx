"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";

export type Testimonial = {
  name: string;
  testimonial: string;
  city?: string | null;
  location?: string | null;
  rating?: number | null;
  image_url?: string | null;
  video_url?: string | null;
  media_ratio?: string | null;
};

export const MIN_INITIAL_TESTIMONIAL_COUNT = 3;
export const MAX_INITIAL_TESTIMONIAL_COUNT = 6;

export function chooseInitialTestimonialCount(total: number): number {
  if (!Number.isSafeInteger(total) || total <= 0) return 0;
  if (total <= MAX_INITIAL_TESTIMONIAL_COUNT) return total;
  if (total <= 9) return 4;
  return MAX_INITIAL_TESTIMONIAL_COUNT;
}

export function Testimonials({ testimonials }: { testimonials: readonly Testimonial[] }) {
  const initialCount = chooseInitialTestimonialCount(testimonials.length);
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const visibleTestimonials = testimonials.slice(0, visibleCount);
  const remainingCount = testimonials.length - visibleTestimonials.length;
  const batchSize = Math.max(MIN_INITIAL_TESTIMONIAL_COUNT, initialCount);

  return (
    <section
      aria-labelledby="customer-feedback-heading"
      className="section testimonials"
      data-testimonials="true"
      data-testimonials-total={testimonials.length}
      data-testimonials-visible={visibleTestimonials.length}
    >
      <div className="section-heading section-heading--left testimonials__heading">
        <p className="eyebrow">Customer experiences</p>
        <h2 id="customer-feedback-heading">What customers say</h2>
        <p>Different dogs learn differently. Here is how PawTrim can fit at home.</p>
      </div>
      <div className="testimonials__grid" aria-live="polite">
        {visibleTestimonials.map((item, index) => (
          <Card asChild key={`${item.name}-${index}`} surface="proof">
            <article
              data-testimonial="true"
              data-testimonial-index={index}
            >
              <span className="testimonial-card__quote" aria-hidden="true">
                “
              </span>
              <blockquote>{item.testimonial}</blockquote>
              <p className="testimonial-card__byline">
                <strong>{item.name}</strong>
                {item.city ? `, ${item.city}` : item.location ? `, ${item.location}` : null}
              </p>
            </article>
          </Card>
        ))}
      </div>
      {remainingCount > 0 ? (
        <button
          className="button button--secondary testimonials__more"
          data-load-more-testimonials="true"
          onClick={() =>
            setVisibleCount((count) => Math.min(testimonials.length, count + batchSize))
          }
          type="button"
        >
          Load more testimonials ({remainingCount})
        </button>
      ) : null}
    </section>
  );
}
