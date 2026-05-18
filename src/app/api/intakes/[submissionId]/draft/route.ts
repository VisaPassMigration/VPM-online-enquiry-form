import { NextResponse } from 'next/server';

import { db } from '@/server/db';
import { assertDraftStatus, buildAuditCreate, mapPrismaError, parseIntakePayload } from '@/server/intakeApi';

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

      await tx.auditEvent.create({
        data: buildAuditCreate(submission.id, 'submission_updated', { status: submission.status }),
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
