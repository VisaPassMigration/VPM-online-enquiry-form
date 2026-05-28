import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { recordAuditEvent } from '@/server/audit';
import { db } from '@/server/db';
import { sendClientIntakeReceivedEmail } from '@/server/email';
import { assertDraftStatus, computeRiskFlags, mapPrismaError, mapToPointsSnapshotCreateInput, mapToRiskPayload, parseIntakePayload, preparePointsSnapshot, prepareStatusTransition, sendClientConfirmationEmailWithAudit, toPointsInput } from '@/server/intakeApi';

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

      await recordAuditEvent({ tx, submissionId: submission.id, eventType: 'submission_submitted', actorRole: 'system', relatedEntityType: 'intake_submission', relatedEntityId: submission.id, fromValue: { status: existing.status }, toValue: { status: 'submitted' }, metadata: { status: 'submitted' }, eventSource: 'intake_api' });
      await recordAuditEvent({ tx, submissionId: submission.id, eventType: 'status_transition_executed', actorRole: 'system', relatedEntityType: 'intake_submission', relatedEntityId: submission.id, fromValue: { status: transition.from }, toValue: { status: transition.to }, internalNote: `Validated transition ${transition.from} -> ${transition.to}.`, metadata: transition, eventSource: 'intake_api' });
      await recordAuditEvent({ tx, submissionId: submission.id, eventType: 'points_snapshot_generated', actorRole: 'system', relatedEntityType: 'intake_submission', relatedEntityId: submission.id, metadata: { estimatedTotal: pointsSnapshot.estimatedTotal, potentialRange: pointsSnapshot.potentialRange }, eventSource: 'intake_api' });
      await recordAuditEvent({ tx, submissionId: submission.id, eventType: 'risk_flag_created', actorRole: 'system', relatedEntityType: 'intake_submission', relatedEntityId: submission.id, metadata: { count: riskFlags.length, flags: riskFlags.map((f) => f.key) }, eventSource: 'intake_api' });

      return { submission, payload };
    });

    await sendClientConfirmationEmailWithAudit({
      sendEmail: () => sendClientIntakeReceivedEmail({
        to: result.payload.email,
        submissionId: result.submission.id,
        clientName: [result.payload.firstName, result.payload.lastName].filter(Boolean).join(' '),
      }),
      recordAudit: async (eventType, metadata) => {
        if (eventType !== 'submission_updated') throw new Error(`Unsupported intake email audit event: ${eventType}`);
        await recordAuditEvent({
          submissionId: result.submission.id,
          eventType,
          actorRole: 'system',
          relatedEntityType: 'intake_submission',
          relatedEntityId: result.submission.id,
          metadata: metadata as Prisma.InputJsonObject,
          eventSource: 'intake_api',
        });
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
