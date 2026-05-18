import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma, RiskResolutionStatus, ReviewDecision, ReviewStage, SubmissionStatus, AuditEventType } from '@prisma/client';

import { db } from '@/server/db';
import { CLIENT_COMMUNICATION_TEMPLATES, createClientCommunicationDraft, requestClientCommunicationRelease } from '@/server/clientCommunications';

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

async function runInternalReviewAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('internalNote') ?? '').trim();
  const actorId = String(formData.get('staffActor') ?? '').trim();
  const actorRole = 'staff';

  if (!submissionId || !action || !note || !actorId) return;

  await db.$transaction(async (tx) => {
    const submission = await tx.intakeSubmission.findUnique({
      where: { id: submissionId },
      include: { currentReviewState: true, riskFlags: { where: { resolutionStatus: RiskResolutionStatus.open } } },
    });

    if (!submission) return;

    let nextStatus = submission.status;
    let nextStage = submission.currentReviewState?.currentStage ?? ReviewStage.intake_triage;
    let decision: ReviewDecision = ReviewDecision.manual_hold;
    let auditType: AuditEventType = AuditEventType.submission_updated;

    if (action === 'mark_under_review') {
      nextStatus = SubmissionStatus.intake_triage_in_progress;
      nextStage = ReviewStage.intake_triage;
      auditType = AuditEventType.status_transition_executed;
    } else if (action === 'request_more_information') {
      nextStatus = SubmissionStatus.awaiting_client_documents;
      decision = ReviewDecision.needs_more_documents;
      nextStage = ReviewStage.document_completeness_check;
      auditType = AuditEventType.status_transition_executed;
    } else if (action === 'escalate_risk_review') {
      nextStatus = SubmissionStatus.risk_review_in_progress;
      decision = ReviewDecision.needs_risk_clarification;
      nextStage = ReviewStage.risk_assessment;
      auditType = AuditEventType.status_transition_executed;
      await tx.riskFlag.updateMany({
        where: { submissionId, resolutionStatus: RiskResolutionStatus.open },
        data: { resolutionStatus: RiskResolutionStatus.under_review },
      });
    } else if (action === 'add_internal_note') {
      decision = submission.currentReviewState?.lastDecision ?? ReviewDecision.manual_hold;
      nextStage = submission.currentReviewState?.currentStage ?? ReviewStage.intake_triage;
    } else {
      return;
    }

    await tx.intakeSubmission.update({
      where: { id: submissionId },
      data: { status: nextStatus },
    });

    await tx.submissionReviewState.upsert({
      where: { submissionId },
      update: { currentStage: nextStage, lastDecision: decision },
      create: { submissionId, currentStage: nextStage, lastDecision: decision },
    });

    await tx.staffReview.create({
      data: {
        submissionId,
        stage: nextStage,
        decision,
        internalNotes: note,
        missingEvidence: [],
        reviewedBy: actorId,
      },
    });

    await tx.auditEvent.create({
      data: {
        submissionId,
        eventType: auditType,
        actorId,
        actorRole,
        fromStatus: submission.status,
        toStatus: nextStatus,
        reason: note,
        metadata: { action, internalOnly: true, requiresHumanReviewBeforeClientCommunication: true },
      },
    });
  });

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}



async function runClientCommunicationAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const actorId = String(formData.get('staffActor') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();
  const communicationType = String(formData.get('communicationType') ?? '').trim() as
    | 'request_more_information'
    | 'consultation_invitation'
    | 'not_progressing_hold';

  if (!submissionId || !actorId || !internalReason) return;

  const template = CLIENT_COMMUNICATION_TEMPLATES[communicationType];
  if (!template) return;

  const created = await createClientCommunicationDraft({
    submissionId,
    communicationType,
    subject: template.subject,
    bodyText: template.bodyText,
    internalReason,
    actorId,
    actorRole: 'staff',
  });

  if (communicationType === 'consultation_invitation') {
    try {
      await requestClientCommunicationRelease({
        submissionId,
        communicationId: created.id,
        communicationType,
        subject: created.subject,
        bodyText: created.bodyText,
        internalReason,
        actorId,
        actorRole: 'staff',
      });
    } catch {
      // blocked state and audit event are handled in the communication service.
    }
  }

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

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
      clientCommunications: { orderBy: { createdAt: 'desc' } },
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
        <p>These actions update internal workflow only. No client outcome is released from this page.</p>
      </section>
      <section className="section review-section">
        <h3>Internal review actions</h3>
        <form action={runInternalReviewAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label htmlFor="internal-note"><strong>Internal note (required)</strong></label>
          <textarea id="internal-note" name="internalNote" required rows={4} />
          <label htmlFor="review-staff-actor"><strong>Staff actor placeholder (required)</strong></label>
          <input id="review-staff-actor" name="staffActor" required placeholder="staff-placeholder" />
          <div className="button-row">
            <button type="submit" name="action" value="mark_under_review">Mark Under Review</button>
            <button type="submit" name="action" value="request_more_information">Request More Information</button>
            <button type="submit" name="action" value="escalate_risk_review">Escalate for Risk Review</button>
            <button type="submit" name="action" value="add_internal_note">Add Internal Note</button>
          </div>
        </form>
      </section>


      <section className="section review-section">
        <h3>Staff-Controlled Client Communications</h3>
        <p><strong>Warning:</strong> Client communication records are internal until released through an authorised staff action. No email is sent from this section yet.</p>
        <form action={runClientCommunicationAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label htmlFor="staff-actor"><strong>Staff actor placeholder (required)</strong></label>
          <input id="staff-actor" name="staffActor" required placeholder="staff-placeholder" />
          <label htmlFor="communication-reason"><strong>Internal reason/note (required)</strong></label>
          <textarea id="communication-reason" name="internalReason" required rows={4} />
          <div className="button-row">
            <button type="submit" name="communicationType" value="request_more_information">Prepare Request More Information</button>
            <button type="submit" name="communicationType" value="consultation_invitation">Prepare Consultation Invitation</button>
            <button type="submit" name="communicationType" value="not_progressing_hold">Prepare Not Progressing / Hold</button>
          </div>
        </form>
      </section>

      <section className="section review-section"><h3>Communication records</h3>{submission.clientCommunications.length === 0 ? <p>No communication records available.</p> : (
        <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Type</th><th>Status</th><th>Subject</th><th>Created</th><th>Released</th><th>Internal reason</th></tr></thead><tbody>{submission.clientCommunications.map((comm) => <tr key={comm.id}><td>{comm.type}</td><td>{comm.status}</td><td>{comm.subject}</td><td>{displayDate(comm.createdAt)}</td><td>{comm.releasedAt ? displayDate(comm.releasedAt) : 'Not released'}</td><td>{comm.internalReason}</td></tr>)}</tbody></table></div>
      )}</section>

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
