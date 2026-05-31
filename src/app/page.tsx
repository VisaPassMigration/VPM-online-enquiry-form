import React from 'react';
import Link from 'next/link';

const features = [
  {
    title: 'Guided client intake',
    description: 'A structured questionnaire helps clients provide the details VPM needs for an organised first review.',
  },
  {
    title: 'Preliminary eligibility review',
    description: 'Information is arranged for staff-led review so VPM can identify likely pathways, gaps, and sensible next steps.',
  },
  {
    title: 'Staff workflow tracking',
    description: 'Submitted enquiries flow into the internal dashboard for controlled triage, follow-up, and operational visibility.',
  },
  {
    title: 'Document-ready process',
    description: 'The intake is designed to highlight supporting information that may be needed later, without claiming document storage is live.',
  },
];

export default function HomePage() {
  return (
    <main className="public-landing">
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="eyebrow">Visa Pass Migration intake platform</p>
          <h1>Start your migration journey with a structured VPM intake.</h1>
          <p>
            Share your background, goals, and key circumstances through a clear guided form. VPM staff use your information for
            preliminary review, careful follow-up, and next-step planning — without automated promises or guaranteed outcomes.
          </p>
          <div className="landing-actions">
            <Link href="/intake" className="primary-btn">Start intake</Link>
            <Link href="/dashboard" className="secondary-btn">Staff dashboard</Link>
          </div>
        </div>
        <aside className="landing-hero__panel" aria-label="How the intake works">
          <p className="eyebrow">How it works</p>
          <ol>
            <li><strong>Complete the intake</strong><span>Tell us about your profile and intended pathway.</span></li>
            <li><strong>VPM reviews</strong><span>Staff assess the information and identify gaps or follow-up needs.</span></li>
            <li><strong>Clear next steps</strong><span>VPM can guide the appropriate next conversation or document preparation.</span></li>
          </ol>
        </aside>
      </section>

      <section className="landing-section" aria-labelledby="landing-features-title">
        <div className="landing-section__heading">
          <p className="eyebrow">Built for clarity</p>
          <h2 id="landing-features-title">A more organised first step for clients and staff.</h2>
          <p>VPM’s intake platform is designed to make early information gathering easier to complete, easier to review, and easier to act on.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <span aria-hidden="true" className="landing-feature-card__accent" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--split" aria-labelledby="next-steps-title">
        <div>
          <p className="eyebrow">What to expect</p>
          <h2 id="next-steps-title">Preliminary review, then staff-controlled follow-up.</h2>
        </div>
        <div className="landing-copy-card">
          <p>
            The intake form helps VPM understand your situation before a detailed discussion. It supports migration guidance and workflow
            tracking, but it does not replace a professional review by VPM staff.
          </p>
        </div>
      </section>

      <section className="landing-disclaimer" aria-labelledby="disclaimer-title">
        <div>
          <p className="eyebrow">Important disclaimer</p>
          <h2 id="disclaimer-title">Preliminary information only</h2>
        </div>
        <p>
          Completing the intake form does not guarantee a visa outcome, eligibility result, invitation, approval, or migration pathway.
          Information submitted through this platform is for preliminary review only. Formal migration advice and next steps require review
          by Visa Pass Migration.
        </p>
      </section>
    </main>
  );
}
