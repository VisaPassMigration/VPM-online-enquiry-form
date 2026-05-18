import { NextResponse } from 'next/server';

import { db } from '@/server/db';
import { buildAuditCreate, mapPrismaError, mapToIntakeSubmissionCreateInput, parseIntakePayload } from '@/server/intakeApi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload, errors } = parseIntakePayload(body);

    if (!payload) return NextResponse.json({ error: 'Invalid payload.', details: errors }, { status: 400 });

    const created = await db.$transaction(async (tx) => {
      const submission = await tx.intakeSubmission.create({
        data: {
          ...mapToIntakeSubmissionCreateInput(payload),
          status: 'draft',
        },
      });

      await tx.auditEvent.create({
        data: buildAuditCreate(submission.id, 'submission_created', { status: submission.status }),
      });

      return submission;
    });

    // No client outcome is sent here.
    // Points are preliminary only and are generated later during controlled submit.
    // Staff review is required before any next-stage communication.
    return NextResponse.json({ submissionId: created.id, status: created.status }, { status: 201 });
  } catch (error) {
    const mapped = mapPrismaError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.code });
  }
}
