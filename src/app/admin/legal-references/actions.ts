import {
  approveLegalReference,
  archiveLegalReference,
  createLegalReference,
  markLegalReferenceReviewed,
  markLegalReferenceStale,
  updateLegalReference,
} from '@/server/legalReferences';
import { LegalReferenceTopic, LegalReferenceType } from '@prisma/client';
import { PERMISSIONS, normalizeRoleKeys } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';

const LEGAL_REFERENCE_TOPIC_VALUES = new Set<string>(Object.values(LegalReferenceTopic));
const LEGAL_REFERENCE_TYPE_VALUES = new Set<string>(Object.values(LegalReferenceType));

function parseLegalReferenceTopic(value: FormDataEntryValue | null): LegalReferenceTopic {
  const topic = String(value ?? '');
  if (!LEGAL_REFERENCE_TOPIC_VALUES.has(topic)) throw new Error('Invalid legal reference topic.');
  return topic as LegalReferenceTopic;
}

function parseLegalReferenceType(value: FormDataEntryValue | null): LegalReferenceType {
  const referenceType = String(value ?? '');
  if (!LEGAL_REFERENCE_TYPE_VALUES.has(referenceType)) throw new Error('Invalid legal reference type.');
  return referenceType as LegalReferenceType;
}

async function requireActor(permission: string) {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(permission as never);
  const actorId = String(session.user.staffUserId ?? '').trim();
  if (!actorId) throw new Error('Missing authenticated staff actor id');
  const actorRoles = normalizeRoleKeys(session.user.roles ?? []);
  const actorRole = actorRoles[0];
  if (!actorRole) throw new Error('Missing authenticated staff actor role');
  return {
    actorId,
    actorName: session.user.name?.trim() || session.user.email?.trim() || actorId,
    actorRole,
    actorStaffUserId: actorId,
    actorRoles,
  };
}

export async function runMutationAction(formData: FormData) {
  'use server';
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const legalReferenceId = String(formData.get('legalReferenceId') ?? '').trim();

  if (action === 'create_legal_reference') {
    await createLegalReference({
      actor: await requireActor(PERMISSIONS.MANAGE_LEGAL_REFERENCE),
      reason,
      referenceType: parseLegalReferenceType(formData.get('referenceType')),
      jurisdiction: String(formData.get('jurisdiction') ?? ''),
      actName: String(formData.get('actName') ?? ''),
      regulationName: String(formData.get('regulationName') ?? ''),
      instrumentName: String(formData.get('instrumentName') ?? ''),
      sectionOrSchedule: String(formData.get('sectionOrSchedule') ?? ''),
      topic: parseLegalReferenceTopic(formData.get('topic')),
      summary: String(formData.get('summary') ?? ''),
      operationalNotes: String(formData.get('operationalNotes') ?? ''),
      riskTriggerNotes: String(formData.get('riskTriggerNotes') ?? ''),
      sourceUrl: String(formData.get('sourceUrl') ?? ''),
      legendComReference: String(formData.get('legendComReference') ?? ''),
      sourceDate: String(formData.get('sourceDate') ?? ''),
    });
    return;
  }

  if (!legalReferenceId) return;

  if (action === 'update_legal_reference') {
    await updateLegalReference({
      actor: await requireActor(PERMISSIONS.MANAGE_LEGAL_REFERENCE),
      legalReferenceId,
      reason,
      data: {
        referenceType: parseLegalReferenceType(formData.get('referenceType')),
        jurisdiction: String(formData.get('jurisdiction') ?? ''),
        actName: String(formData.get('actName') ?? ''),
        regulationName: String(formData.get('regulationName') ?? ''),
        instrumentName: String(formData.get('instrumentName') ?? ''),
        sectionOrSchedule: String(formData.get('sectionOrSchedule') ?? ''),
        topic: parseLegalReferenceTopic(formData.get('topic')),
        summary: String(formData.get('summary') ?? ''),
        operationalNotes: String(formData.get('operationalNotes') ?? ''),
        riskTriggerNotes: String(formData.get('riskTriggerNotes') ?? ''),
        sourceUrl: String(formData.get('sourceUrl') ?? ''),
        legendComReference: String(formData.get('legendComReference') ?? ''),
        sourceDate: String(formData.get('sourceDate') ?? ''),
      },
    });
  }

  if (action === 'mark_reviewed') await markLegalReferenceReviewed({ actor: await requireActor(PERMISSIONS.REVIEW_LEGAL_REFERENCE), legalReferenceId, reason });
  if (action === 'approve') await approveLegalReference({ actor: await requireActor(PERMISSIONS.APPROVE_LEGAL_REFERENCE), legalReferenceId, reason });
  if (action === 'mark_stale') await markLegalReferenceStale({ actor: await requireActor(PERMISSIONS.MANAGE_LEGAL_REFERENCE), legalReferenceId, reason });
  if (action === 'archive') await archiveLegalReference({ actor: await requireActor(PERMISSIONS.MANAGE_LEGAL_REFERENCE), legalReferenceId, reason });
}
