import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/server/audit';
import { db } from '@/server/db';
import { mapPrismaError, mapToIntakeSubmissionCreateInput, parseIntakePayload } from '@/server/intakeApi';
import { isRegistrationReferenceUniqueConflict, nextRegistrationReference } from '@/server/registrationReferences';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload, errors } = parseIntakePayload(body);

    if (!payload) return NextResponse.json({ error: 'Invalid payload.', details: errors }, { status: 400 });

    let created;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const registrationDate = new Date();
      try {
        created = await db.$transaction(async (tx) => {
          const registrationReference = await nextRegistrationReference(tx, registrationDate);
          const submission = await tx.intakeSubmission.create({
            data: {
              ...mapToIntakeSubmissionCreateInput(payload),
              status: 'draft',
              registrationReference,
              createdAt: registrationDate,
            },
          });

          await recordAuditEvent({
            tx,
            submissionId: submission.id,
            eventType: 'submission_created',
            actorRole: 'system',
            relatedEntityType: 'intake_submission',
            relatedEntityId: submission.id,
            toValue: { status: submission.status, registrationReference: submission.registrationReference },
            metadata: { status: submission.status, registrationReference: submission.registrationReference },
            eventSource: 'intake_api',
          });

          return submission;
        });
        break;
      } catch (error) {
        if (isRegistrationReferenceUniqueConflict(error) && attempt < 2) continue;
        throw error;
      }
    }

    if (!created) throw new Error('Unable to create intake submission.');

    // No client outcome is sent here.
    // Points are preliminary only and are generated later during controlled submit.
    // Staff review is required before any next-stage communication.
    return NextResponse.json({ submissionId: created.id, registrationReference: created.registrationReference, status: created.status }, { status: 201 });
  } catch (error) {
    const mapped = mapPrismaError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.code });
  }
}
