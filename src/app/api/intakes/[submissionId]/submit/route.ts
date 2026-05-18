import { NextResponse } from 'next/server';

import { db } from '@/server/db';
import { sendClientIntakeReceivedEmail } from '@/server/email';
import { assertDraftStatus, buildAuditCreate, computeRiskFlags, mapPrismaError, mapToPointsSnapshotCreateInput, mapToRiskPayload, parseIntakePayload, preparePointsSnapshot, prepareStatusTransition, sendClientConfirmationEmailWithAudit, toPointsInput } from '@/server/intakeApi';

type RouteContext = { params: Promise<{ submissionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { submissionId } = await context.params;

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.intakeSubmission.findUnique({ where: { id: submissionId } });
      if (!existing) throw Object.assign(new Error('Submission not found.'), { code: 404 });
      assertDraftStatus(existing.status);

      const { payload, errors } = parseIntakePayload(existing.payload);
      if (!payload) throw Object.assign(new Error('Invalid payload.'), { code: 400, details: errors });

      const transition = prepareStatusTransition(existing.status, 'submitted');
      const pointsSnapshot = preparePointsSnapshot({ pointsInput: toPointsInput(payload), generatedBy: 'system' });
      const riskFlags = computeRiskFlags(mapToRiskPayload({ ...payload, preliminaryPoints: pointsSnapshot.estimatedTotal, missingItems: pointsSnapshot.missingItems }));

      const submission = await tx.intakeSubmission.update({
        where: { id: submissionId },
        data: { status: 'submitted', submittedAt: new Date() },
      });

      await tx.pointsSnapshot.create({ data: mapToPointsSnapshotCreateInput(submission.id, pointsSnapshot) });
      await tx.riskFlag.createMany({
        data: riskFlags.map((flag) => ({
          submissionId: submission.id,
          riskCode: flag.key,
          severity: flag.severity,
          detectedBy: 'system',
        })),
      });

      await tx.submissionReviewState.upsert({
        where: { submissionId: submission.id },
        update: { currentStage: 'intake_triage', lastDecision: null, mandatoryStagesComplete: false, releaseChecklistSigned: false },
        create: { submissionId: submission.id, currentStage: 'intake_triage' },
      });

      await tx.auditEvent.create({ data: buildAuditCreate(submission.id, 'submission_submitted', { status: 'submitted' }) });
      await tx.auditEvent.create({ data: buildAuditCreate(submission.id, 'status_transition_requested', transition) });
      await tx.auditEvent.create({ data: buildAuditCreate(submission.id, 'status_transition_applied', transition) });
      await tx.auditEvent.create({ data: buildAuditCreate(submission.id, 'points_snapshot_generated', { estimatedTotal: pointsSnapshot.estimatedTotal, potentialRange: pointsSnapshot.potentialRange }) });
      await tx.auditEvent.create({ data: buildAuditCreate(submission.id, 'risk_flags_computed', { count: riskFlags.length, flags: riskFlags.map((f) => f.key) }) });

      return { submission, payload };
    });

    await sendClientConfirmationEmailWithAudit({
      sendEmail: () => sendClientIntakeReceivedEmail({
        to: result.payload.email,
        submissionId: result.submission.id,
        clientName: [result.payload.firstName, result.payload.lastName].filter(Boolean).join(' '),
      }),
      recordAudit: async (eventType, metadata) => {
        await db.auditEvent.create({ data: buildAuditCreate(result.submission.id, eventType, metadata) });
      },
    });

    // No client outcome is sent here.
    // Points are preliminary only and must be treated as internal estimates.
    // Staff review is required before any next-stage communication.
    return NextResponse.json({ submissionId: result.submission.id, status: result.submission.status, submittedAt: result.submission.submittedAt });
  } catch (error) {
    const mapped = mapPrismaError(error);
    const details = typeof error === 'object' && error && 'details' in error ? (error as { details?: unknown }).details : undefined;
    return NextResponse.json({ error: mapped.message, details }, { status: mapped.code });
  }
}
