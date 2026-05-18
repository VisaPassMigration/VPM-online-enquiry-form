import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prisma, RiskResolutionStatus } from '@prisma/client';

import { db } from '@/server/db';

type IntakePayload = Prisma.JsonObject & Record<string, string | number | boolean | undefined | null>;

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(dateTime);

const boolText = (value: boolean | undefined) => (value === undefined ? 'Not provided' : value ? 'Yes' : 'No');

const safeText = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return 'Not provided';
  if (typeof value === 'string' && !value.trim()) return 'Not provided';
  return String(value);
};

const renderRows = (pairs: Array<[string, string | number | undefined | null]>) => (
  <dl className="review-grid">
    {pairs.map(([label, value]) => (
      <div key={label} className="review-grid-row">
        <dt>{label}</dt>
        <dd>{safeText(value)}</dd>
      </div>
    ))}
  </dl>
);

export default async function IntakeReviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const submission = await db.intakeSubmission.findUnique({
    where: { id: submissionId },
    include: {
      pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      riskFlags: { where: { resolutionStatus: { in: [RiskResolutionStatus.open, RiskResolutionStatus.under_review] } }, orderBy: { detectedAt: 'desc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      currentReviewState: true,
      auditEvents: { orderBy: { eventAt: 'desc' }, take: 30 },
    },
  });

  if (!submission) notFound();

  const payload = (submission.payload && typeof submission.payload === 'object' && !Array.isArray(submission.payload)
    ? submission.payload
    : {}) as IntakePayload;
  const latestPoints = submission.pointsSnapshots[0];

  return (
    <>
      <section className="hero">
        <h1>Intake Review</h1>
        <p>Submission ID: {submission.id}</p>
        <p><Link href="/dashboard">← Back to dashboard</Link></p>
      </section>
      <section className="section dashboard-note" role="note" aria-label="Internal intake review note">
        <strong>Important:</strong> Internal review page only. No client outcome should be released without authorised human review.
      </section>

      <section className="section review-section"><h3>Client details</h3>{renderRows([
        ['First name', payload.firstName as string], ['Last name', payload.lastName as string], ['Date of birth', payload.dateOfBirth as string],
        ['Nationality', payload.nationality as string], ['Country of residence', payload.countryOfResidence as string], ['Address', payload.address as string],
      ])}</section>
      <section className="section review-section"><h3>Contact details</h3>{renderRows([
        ['Email', payload.email as string], ['Phone', payload.phone as string], ['Preferred contact method', payload.contactMethod as string],
      ])}</section>
      <section className="section review-section"><h3>Migration goal</h3>{renderRows([
        ['Interested country', payload.interestedCountry as string], ['Main goal', payload.mainGoal as string], ['Timeframe', payload.timeframe as string],
      ])}</section>
      <section className="section review-section"><h3>Family / partner details</h3>{renderRows([
        ['Marital status', payload.maritalStatus as string], ['Dependants', payload.dependants as string], ['Migrate with family', payload.migrateWithFamily as string], ['Partner name', payload.partnerName as string], ['Partner nationality', payload.partnerNationality as string],
        ['Partner English competency', payload.partnerEnglishCompetency as string], ['Partner skills assessment', payload.partnerSkillsAssessment as string],
      ])}</section>
      <section className="section review-section"><h3>Education</h3>{renderRows([
        ['Highest qualification', payload.highestQualification as string], ['Field of study', payload.fieldOfStudy as string], ['Institution', payload.institution as string], ['Study country', payload.studyCountry as string], ['Completion year', payload.completionYear as string],
      ])}</section>
      <section className="section review-section"><h3>Employment</h3>{renderRows([
        ['Current occupation', payload.currentOccupation as string], ['Migration occupation', payload.migrationOccupation as string], ['Work experience years', payload.workExperienceYears as string],
        ['Current employer', payload.currentEmployer as string], ['Duties summary', payload.dutiesSummary as string],
      ])}</section>
      <section className="section review-section"><h3>English details</h3>{renderRows([
        ['English test taken', boolText(payload.englishTestTaken as boolean | undefined)], ['English test type', payload.englishTestType as string], ['English overall band', payload.englishOverallBand as number | undefined], ['English test date', payload.englishTestDate as string], ['English score summary', payload.englishScoreSummary as string],
      ])}</section>
      <section className="section review-section"><h3>Risk disclosures and risk details</h3>{renderRows([
        ['Previous visa refusal', boolText(payload.previousVisaRefusal as boolean | undefined)], ['Cancellation/overstay/removal', boolText(payload.cancellationOverstayOrRemoval as boolean | undefined)], ['Criminal history', boolText(payload.criminalHistory as boolean | undefined)], ['Health condition', boolText(payload.healthCondition as boolean | undefined)],
        ['Refusal details', payload.refusalDetails as string], ['Cancellation/overstay details', payload.cancellationOverstayDetails as string], ['Criminal details', payload.criminalDetails as string], ['Health details', payload.healthDetails as string], ['General risk details', payload.riskDetails as string],
      ])}</section>

      <section className="section review-section"><h3>Latest points snapshot</h3>{latestPoints ? renderRows([
        ['Generated at', displayDate(latestPoints.generatedAt)], ['Total points', latestPoints.totalPoints], ['Calculator version', latestPoints.calculatorVersion], ['Generated by', latestPoints.generatedBy],
        ['Missing items', latestPoints.missingItems.length ? latestPoints.missingItems.join(', ') : 'None'], ['Preliminary label', latestPoints.preliminaryLabel],
      ]) : <p>No points snapshot available yet.</p>}</section>

      <section className="section review-section"><h3>Active risk flags</h3>{submission.riskFlags.length === 0 ? <p>No active risk flags.</p> : (
        <ul className="review-list">{submission.riskFlags.map((flag) => <li key={flag.id}><strong>{flag.riskCode}</strong> ({flag.severity}) — {flag.resolutionStatus}</li>)}</ul>
      )}</section>

      <section className="section review-section"><h3>Document metadata</h3>{submission.documents.length === 0 ? <p>No document metadata available.</p> : (
        <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Type</th><th>Filename</th><th>MIME</th><th>Size (bytes)</th><th>Uploaded by</th><th>Status</th><th>Uploaded at</th></tr></thead><tbody>{submission.documents.map((doc) => <tr key={doc.id}><td>{doc.documentType}</td><td>{doc.originalFilename}</td><td>{doc.mimeType}</td><td>{doc.fileSizeBytes}</td><td>{doc.uploadedBy}</td><td>{doc.verificationStatus}</td><td>{displayDate(doc.uploadedAt)}</td></tr>)}</tbody></table></div>
      )}</section>

      <section className="section review-section"><h3>Current review state</h3>{submission.currentReviewState ? renderRows([
        ['Current stage', submission.currentReviewState.currentStage], ['Last decision', submission.currentReviewState.lastDecision], ['Mandatory stages complete', boolText(submission.currentReviewState.mandatoryStagesComplete)], ['Release checklist signed', boolText(submission.currentReviewState.releaseChecklistSigned)],
        ['Senior sign-off by', submission.currentReviewState.seniorSignOffBy], ['Senior sign-off at', submission.currentReviewState.seniorSignOffAt ? displayDate(submission.currentReviewState.seniorSignOffAt) : 'Not provided'], ['Updated at', displayDate(submission.currentReviewState.updatedAt)],
      ]) : <p>No review state available yet.</p>}</section>

      <section className="section review-section"><h3>Audit timeline</h3>{submission.auditEvents.length === 0 ? <p>No audit events available.</p> : (
        <ul className="review-list">{submission.auditEvents.map((event) => <li key={event.id}><strong>{event.eventType}</strong> at {displayDate(event.eventAt)}{event.reason ? ` — ${event.reason}` : ''}</li>)}</ul>
      )}</section>
    </>
  );
}
