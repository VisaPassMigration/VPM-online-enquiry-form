import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/server/audit';
import { db } from '@/server/db';
import { assertDraftStatus, mapPrismaError, parseIntakePayload } from '@/server/intakeApi';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ submissionId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { submissionId } = await context.params;
    const body = await request.json();
    const { payload, errors } = parseIntakePayload(body);

    if (!payload) return NextResponse.json({ error: 'Invalid payload.', details: errors }, { status: 400 });

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.intakeSubmission.findUnique({ where: { id: submissionId } });
      if (!existing) throw Object.assign(new Error('Submission not found.'), { code: 404 });
      assertDraftStatus(existing.status);

      const submission = await tx.intakeSubmission.update({
        where: { id: submissionId },
        data: { payload },
      });

      await recordAuditEvent({
        tx,
        submissionId: submission.id,
        eventType: 'submission_updated',
        actorRole: 'system',
        relatedEntityType: 'intake_submission',
        relatedEntityId: submission.id,
        toValue: { status: submission.status },
        metadata: { status: submission.status },
        eventSource: 'intake_api',
      });

      return submission;
    });

    // No client outcome is sent here.
    // Points are preliminary only and are generated later during controlled submit.
    // Staff review is required before any next-stage communication.
    return NextResponse.json({ submissionId: updated.id, status: updated.status });
  } catch (error) {
    const mapped = mapPrismaError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.code });
  }
}
