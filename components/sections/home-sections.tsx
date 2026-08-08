import Image from "next/image";
import type { ReactNode } from "react";

import { PreservedLink } from "@/components/navigation/preserved-link";
import { publicEnv } from "@/lib/public-env";

type FeatureProps = {
  number: string;
  title: string;
  children: ReactNode;
};

function Step({ number, title, children }: FeatureProps) {
  return (
    <article className="step-card">
      <span className="step-card__number" aria-hidden="true">
        {number}
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

export function TrustStrip() {
  return (
    <section className="trust-strip" aria-label="Order and product details">
      <div>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 7h11v9H3zM14 10h3l4 4v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
        <span><strong>Tracked delivery</strong> to Australia</span>
      </div>
      <div>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 21s8-4.5 8-11V5l-8-3-8 3v5c0 6.5 8 11 8 11Zm-3.5-10 2.2 2.2 4.8-5" />
        </svg>
        <span><strong>Supervised routine</strong> for front nails</span>
      </div>
      <div>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z" />
        </svg>
        <span><strong>Secure checkout</strong> on our site</span>
      </div>
    </section>
  );
}

export function ProblemSolution() {
  return (
    <section className="section section--split section--white" aria-labelledby="calmer-heading">
      <div className="section__media section__media--offset">
        <Image
          alt="A calm reward-board routine contrasted with a stressful clipper moment"
          height="1254"
          loading="lazy"
          sizes="(min-width: 900px) 50vw, 100vw"
          src="/assets/problem_solution_visual_01.png"
          width="1254"
        />
      </div>
      <div className="section__copy">
        <p className="eyebrow">A calmer starting point</p>
        <h2 id="calmer-heading">Replace the clipper battle</h2>
        <p className="section__lead">
          If nail day starts with hiding, pulling away, or a tense grip on the paw,
          PawTrim offers a different routine. Your dog follows the reward and does the
          scratching while you guide and supervise.
        </p>
        <div className="contrast-list">
          <div>
            <span>Instead of</span>
            <strong>Forced paw holding</strong>
          </div>
          <div>
            <span>Try</span>
            <strong>Voluntary, treat-led scratching</strong>
          </div>
        </div>
        <a className="text-link" href="#choose-your-set">
          Choose your set <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="section section--how" aria-labelledby="how-heading">
      <div className="section-heading">
        <p className="eyebrow">A simple training loop</p>
        <h2 id="how-heading">Three steps to a calmer routine</h2>
        <p>Keep the first attempts brief and let your dog learn at their own pace.</p>
      </div>
      <div className="how-grid">
        <div className="steps">
          <Step number="01" title="Add the reward">
            Place treats in the reward area so the board earns your dog&apos;s interest.
          </Step>
          <Step number="02" title="Invite the scratch">
            Reward front-paw contact and let repeated scratches do the gradual filing.
          </Step>
          <Step number="03" title="Pause and repeat">
            End while the session is calm, then build the routine through short repeats.
          </Step>
        </div>
        <figure className="detail-figure">
          <Image
            alt="Close views of the treat area, filing surface, base and a front paw on the board"
            height="1254"
            loading="lazy"
            sizes="(min-width: 900px) 50vw, 100vw"
            src="/assets/how_it_works_macro_01.png"
            width="1254"
          />
          <figcaption>Reward area, filing surface and front-paw contact shown up close.</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function UseCases() {
  const uses = [
    ["Clipper-averse dogs", "A lower-pressure path for dogs that resist direct clipping."],
    ["Between groomer visits", "A repeatable way to maintain front nails at home."],
    ["New routines", "A reward-led habit for puppies or newly adopted dogs."],
    ["Busy households", "Multiple boards can keep the routine close at hand."],
  ];

  return (
    <section className="section section--split section--teal" aria-labelledby="fits-heading">
      <div className="section__copy">
        <p className="eyebrow eyebrow--light">Built around everyday life</p>
        <h2 id="fits-heading">Where PawTrim fits</h2>
        <div className="use-list">
          {uses.map(([title, text], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="section__media">
        <Image
          alt="Dogs of different ages and household routines using reward boards"
          height="1254"
          loading="lazy"
          sizes="(min-width: 900px) 50vw, 100vw"
          src="/assets/use_case_cards_01.png"
          width="1254"
        />
      </div>
    </section>
  );
}

export function ProofGallery() {
  return (
    <section className="section section--proof" aria-labelledby="proof-heading">
      <div className="section-heading section-heading--left">
        <p className="eyebrow">Realistic progress</p>
        <h2 id="proof-heading">Look closely at the routine</h2>
        <p>
          PawTrim is a gradual front-nail maintenance tool. Consistent, supervised
          practice matters more than one long session.
        </p>
      </div>
      <div className="proof-grid">
        <figure className="proof-card proof-card--large">
          <Image
            alt="Close view of a dog placing a front paw on the filing surface"
            height="1254"
            loading="lazy"
            sizes="(min-width: 600px) 57vw, 100vw"
            src="/assets/demo_gallery_size_01.png"
            width="1254"
          />
          <figcaption>
            <strong>Follow your dog&apos;s pace</strong>
            <span>Different dogs can take different amounts of time to learn.</span>
          </figcaption>
        </figure>
        <figure className="proof-card">
          <Image
            alt="A short-session progress view of front nails at the reward board"
            height="1254"
            loading="lazy"
            sizes="(min-width: 600px) 43vw, 100vw"
            src="/assets/demo_gallery_timer_01.png"
            width="1254"
          />
          <figcaption>
            <strong>Think short and repeatable</strong>
            <span>Results are gradual, not an instant clipping-style change.</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function SafetyExpectations() {
  return (
    <section className="section section--split section--safety" aria-labelledby="expect-heading">
      <div className="section__media">
        <Image
          alt="A supervised front-paw scratch-board session with close views of nail contact"
          height="1254"
          loading="lazy"
          sizes="(min-width: 900px) 50vw, 100vw"
          src="/assets/safety_fit_graphic_01.png"
          width="1254"
        />
      </div>
      <div className="section__copy">
        <p className="eyebrow">Before the first session</p>
        <h2 id="expect-heading">Start with honest expectations</h2>
        <ul className="expectation-list">
          <li>
            <strong>Focus on front nails.</strong>
            <span>The scratching motion mainly supports front-nail maintenance.</span>
          </li>
          <li>
            <strong>Give learning time.</strong>
            <span>Some dogs engage quickly while others need calm, repeated practice.</span>
          </li>
          <li>
            <strong>Stay close.</strong>
            <span>Supervise every session and keep an eye on paw placement.</span>
          </li>
          <li>
            <strong>Keep it gradual.</strong>
            <span>This is upkeep, not an instant replacement for every grooming need.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

const faqs = [
  {
    question: "Is PawTrim for all four paws?",
    answer:
      "PawTrim is mainly a front-nail maintenance tool. Continue your normal paw-care routine for needs the board does not cover.",
  },
  {
    question: "Will my dog use it?",
    answer:
      "Some dogs engage quickly, while others need short training sessions. Start with treats, reward the first paw contact, and avoid forcing the interaction.",
  },
  {
    question: "How soon will nails look shorter?",
    answer:
      "There is no fixed timeline. Progress is gradual and depends on your dog's motivation and how consistently you repeat short sessions.",
  },
  {
    question: "Do I need to supervise?",
    answer:
      "Yes. Stay with your dog throughout the session, keep it brief, and watch how the front paws meet the filing surface.",
  },
  {
    question: "What if I am unsure about fit?",
    answer: `The demonstrations show dogs in different routines, but exact dimensions are not provided. Email ${publicEnv.contactEmail} before buying if fit is a concern.`,
  },
  {
    question: "How long does delivery take?",
    answer:
      "Tracked delivery to Australia is estimated at 7 - 14 business days. Tracking details are emailed after dispatch.",
  },
  {
    question: "What if I need to make a return?",
    answer: "Read the returns policy for the current eligibility and process before ordering.",
  },
];

export function Faq() {
  return (
    <section className="section section--faq" aria-labelledby="faq-heading">
      <div className="faq-intro">
        <p className="eyebrow">Questions, answered</p>
        <h2 id="faq-heading">Know before you buy</h2>
        <p>Clear answers about training, front-nail use and delivery.</p>
        <Image
          alt="Visual guide to supervised front-nail reward-board use"
          height="1254"
          loading="lazy"
          sizes="(min-width: 900px) 35vw, 100vw"
          src="/assets/faq_visual_01.png"
          width="1254"
        />
      </div>
      <div className="faq-list">
        {faqs.map((faq, index) => (
          <details key={faq.question} open={index === 0}>
            <summary>
              {faq.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              {faq.answer}
              {faq.question.includes("return") ? (
                <>
                  {" "}
                  <PreservedLink href="/returns-policy">View returns policy</PreservedLink>.
                </>
              ) : null}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final-cta" aria-labelledby="final-heading">
      <Image
        alt="A relaxed dog resting beside two PawTrim Reward Boards"
        height="1254"
        loading="lazy"
        sizes="(min-width: 900px) 58vw, 100vw"
        src="/assets/final_cta_lifestyle_01.png"
        width="1254"
      />
      <div className="final-cta__content">
        <p className="eyebrow eyebrow--light">Your calmer routine can start here</p>
        <h2 id="final-heading">Make nail care feel calmer</h2>
        <p>
          Choose the 2-Board Home Set for two dogs, two rooms, or one easy-to-repeat
          routine.
        </p>
        <div className="final-cta__offer">
          <span>2-Board Home Set</span>
          <strong>A$39.95</strong>
        </div>
        <PreservedLink
          className="button button--accent button--full"
          data-analytics-event="CTAClick"
          data-primary-action="true"
          href="/checkout?offer=2"
        >
          Buy Now
        </PreservedLink>
        <small>Tracked delivery to Australia: 7 - 14 business days.</small>
      </div>
    </section>
  );
}
