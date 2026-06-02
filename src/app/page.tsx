import React from 'react';
import Link from 'next/link';

const features = [
  {
    title: 'Guided client registration',
    description: 'A structured questionnaire helps clients provide the details VPM needs for an organised first review.',
  },
  {
    title: 'Preliminary pathway review',
    description: 'Your information is arranged for VPM-led review so our team can identify possible pathways, missing details, and sensible next steps.',
  },
  {
    title: 'Client progress tracking',
    description: 'Submitted registrations are received directly by VPM so our team can track follow-ups, review status, and next-step planning internally.',
  },
  {
    title: 'Supporting information readiness',
    description: 'The form helps VPM identify which supporting information may be needed later, so document requests can be clearer and more targeted.',
  },
];

export default function HomePage() {
  return (
    <main className="public-landing">
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="eyebrow">Visa Pass Migration Registration Platform</p>
          <h1>Start your migration journey with a structured VPM registration.</h1>
          <p>
            Share your background, goals, and key circumstances through a clear guided form. Visa Pass Migration uses your information for
            preliminary review, careful follow-up, and next-step planning — without the automated promises or guaranteed outcomes.
          </p>
          <div className="landing-actions">
            <Link href="/intake" className="primary-btn">Start Registration</Link>
            <Link href="/#book-consultation" className="secondary-btn">Book a Consultation</Link>
          </div>
        </div>
        <aside id="how-it-works" className="landing-hero__panel" aria-label="How the registration works">
          <p className="eyebrow">How It Works</p>
          <ol>
            <li><strong>Complete the Registration Form</strong><span>Tell us about your background, current situation, and intended migration pathway.</span></li>
            <li><strong>VPM completes a preliminary review</strong><span>Our team reviews your information to identify possible pathway options, gaps, and follow-up needs.</span></li>
            <li><strong>Receive clear next steps</strong><span>VPM can guide the appropriate next conversation, document preparation, or professional review process.</span></li>
          </ol>
        </aside>
      </section>

      <section className="landing-section" aria-labelledby="landing-features-title">
        <div className="landing-section__heading">
          <p className="eyebrow">Built for clarity</p>
          <h2 id="landing-features-title">A more organised first step for our clients.</h2>
          <p>VPM’s registration platform is designed to make the initial information-gathering process easier for clients to complete, easier for VPM to review, and easier for our team to follow up on.</p>
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

      <section className="landing-section landing-section--centered" aria-labelledby="next-steps-title">
        <div className="landing-section__heading landing-section__heading--centered">
          <p className="eyebrow">What to expect</p>
          <h2 id="next-steps-title">Preliminary review, then guided follow-up.</h2>
          <p>
            The registration form helps VPM understand your situation before a detailed discussion. It supports migration guidance and workflow
            tracking, but it does not replace a professional review by VPM staff.
          </p>
        </div>
      </section>

      <section id="book-consultation" className="landing-section landing-consultation" aria-labelledby="consultation-title">
        <div className="landing-consultation__intro">
          <p className="eyebrow">Consultations</p>
          <h2 id="consultation-title">The right consultation starts with the right information.</h2>
          <p>
            Before booking a consultation, please complete the Registration Form so VPM can understand your background, goals, and intended
            migration pathway.
          </p>
          <Link href="/intake" className="primary-btn">Complete Registration First</Link>
          <p className="landing-consultation__note">If VPM has already reviewed your information, our team may provide a booking link or next-step instructions directly.</p>
        </div>
        <ol className="landing-consultation__steps" aria-label="Pathway to consultation">
          <li>
            <span className="landing-consultation__step-number">1</span>
            <div>
              <strong>Complete the Registration Form</strong>
              <p>Share your details through the structured registration form.</p>
            </div>
          </li>
          <li>
            <span className="landing-consultation__step-number">2</span>
            <div>
              <strong>VPM completes a preliminary review</strong>
              <p>Our team reviews your information and identifies the appropriate next-step pathway.</p>
            </div>
          </li>
          <li>
            <span className="landing-consultation__step-number">3</span>
            <div>
              <strong>Receive consultation or next-step guidance</strong>
              <p>If a consultation is appropriate, VPM may provide a booking link or further instructions directly.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="landing-disclaimer landing-disclaimer--centered" aria-labelledby="disclaimer-title">
        <div>
          <p className="eyebrow">Important disclaimer</p>
          <h2 id="disclaimer-title">Preliminary information only</h2>
        </div>
        <p>
          Completing the registration form does not guarantee a visa outcome, eligibility result, invitation, approval, or migration pathway.
          Information submitted through this platform is for preliminary review only. Formal migration advice and next steps require review
          by Visa Pass Migration.
        </p>
      </section>
    </main>
  );
}
