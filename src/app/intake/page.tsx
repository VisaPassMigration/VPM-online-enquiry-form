const intakeSections = [
  'Client questionnaire',
  'Document uploads',
  'Estimated points calculator',
  'Consultation booking after approval',
];

export default function IntakePage() {
  return (
    <>
      <section className="hero">
        <h1>Client Intake</h1>
        <p>
          Intake workflow placeholders for capturing applicant details and supporting evidence.
        </p>
      </section>

      <section className="grid" aria-label="Intake feature sections">
        {intakeSections.map((title) => (
          <article className="section" key={title}>
            <h3>{title}</h3>
            <p>Placeholder content for future implementation.</p>
          </article>
        ))}
      </section>
    </>
  );
}
