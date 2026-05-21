import type { LegalReferenceStatus, LegalReferenceTopic, LegalReferenceType } from '@prisma/client';

import { PERMISSIONS, type RoleKey, hasPermission, isCanonicalRoleKey, normalizeRoleKeys } from './auth/permissions';
import { recordAuditEvent } from './audit';
import { db } from './db';

type StaffActorContext = { actorId: string; actorName: string; actorRole: RoleKey; actorStaffUserId: string; actorRoles: RoleKey[] };
const META = { internalOnly: true, legalReference: true };
const AUDIT_SUBMISSION_ID = 'legal-reference-library';

function normalize(v?: string | null) { const t = v?.trim(); return t ? t : undefined; }
function requireReason(reason?: string) { const r = normalize(reason); if (!r) throw new Error('Internal note/reason is required.'); return r; }
function requireStaffActorContext(actor: StaffActorContext) { if (!actor.actorId?.trim() || !actor.actorName?.trim() || !actor.actorRole?.trim() || !actor.actorStaffUserId?.trim()) throw new Error('Authenticated staff actor context is required.'); }
function canonicalActorRoles(actor: StaffActorContext): RoleKey[] {
  return normalizeRoleKeys(actor.actorRoles);
}
function canonicalActorRole(actor: StaffActorContext): RoleKey {
  if (!isCanonicalRoleKey(actor.actorRole)) throw new Error('Authenticated actor role must be a canonical role key.');
  return actor.actorRole;
}
function assertPermission(actor: StaffActorContext, permission: string) { if (!hasPermission(canonicalActorRoles(actor), permission as never)) throw new Error(`Missing permission: ${permission}.`); }

const TRANSITIONS: Record<LegalReferenceStatus, LegalReferenceStatus[]> = {
  draft: ['reviewed', 'stale', 'archived'],
  reviewed: ['approved', 'stale', 'archived'],
  approved: ['stale', 'archived'],
  stale: ['reviewed', 'archived'],
  archived: [],
};

function assertStatusTransition(from: LegalReferenceStatus, to: LegalReferenceStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid legal reference status transition: ${from} -> ${to}.`);
  }
}

async function writeAudit(input: { legalReferenceId: string; eventType: 'legal_reference_created'|'legal_reference_updated'|'legal_reference_reviewed'|'legal_reference_approved'|'legal_reference_marked_stale'|'legal_reference_archived'; actor: StaffActorContext; reason: string; fromValue?: unknown; toValue?: unknown; }) {
  await recordAuditEvent({
    submissionId: AUDIT_SUBMISSION_ID,
    eventType: input.eventType,
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: canonicalActorRole(input.actor),
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'legal_reference',
    relatedEntityId: input.legalReferenceId,
    fromValue: (input.fromValue ?? null) as any,
    toValue: (input.toValue ?? null) as any,
    reason: input.reason,
    internalNote: input.reason,
    metadata: META,
  });
}

export async function createLegalReference(input: { actor: StaffActorContext; reason: string; referenceType: LegalReferenceType; jurisdiction: string; actName?: string; regulationName?: string; instrumentName?: string; sectionOrSchedule: string; topic: LegalReferenceTopic; summary: string; operationalNotes?: string; riskTriggerNotes?: string; sourceUrl?: string; legendComReference?: string; sourceDate?: string | Date; }) {
  requireStaffActorContext(input.actor); assertPermission(input.actor, PERMISSIONS.MANAGE_LEGAL_REFERENCE); const reason = requireReason(input.reason);
  const created = await db.legalReference.create({ data: { referenceType: input.referenceType, jurisdiction: input.jurisdiction.trim(), actName: normalize(input.actName) ?? null, regulationName: normalize(input.regulationName) ?? null, instrumentName: normalize(input.instrumentName) ?? null, sectionOrSchedule: input.sectionOrSchedule.trim(), topic: input.topic, summary: input.summary.trim(), operationalNotes: normalize(input.operationalNotes) ?? null, riskTriggerNotes: normalize(input.riskTriggerNotes) ?? null, sourceUrl: normalize(input.sourceUrl) ?? null, legendComReference: normalize(input.legendComReference) ?? null, sourceDate: input.sourceDate ? new Date(input.sourceDate) : null } });
  await writeAudit({ legalReferenceId: created.id, eventType: 'legal_reference_created', actor: input.actor, reason, toValue: created.status });
  return created;
}

export async function updateLegalReference(input: { actor: StaffActorContext; legalReferenceId: string; reason: string; data: Partial<{ referenceType: LegalReferenceType; jurisdiction: string; actName: string | null; regulationName: string | null; instrumentName: string | null; sectionOrSchedule: string; topic: LegalReferenceTopic; summary: string; operationalNotes: string | null; riskTriggerNotes: string | null; sourceUrl: string | null; legendComReference: string | null; sourceDate: string | Date | null; }>; }) {
  requireStaffActorContext(input.actor); assertPermission(input.actor, PERMISSIONS.MANAGE_LEGAL_REFERENCE); const reason = requireReason(input.reason);
  const existing = await db.legalReference.findUniqueOrThrow({ where: { id: input.legalReferenceId } });
  const changedFields = Object.keys(input.data).filter((k) => (existing as Record<string, unknown>)[k] !== (input.data as Record<string, unknown>)[k]);
  const updated = await db.legalReference.update({ where: { id: input.legalReferenceId }, data: { ...input.data, sourceDate: input.data.sourceDate ? new Date(input.data.sourceDate) : input.data.sourceDate === null ? null : undefined, version: { increment: 1 } } });
  await recordAuditEvent({
    submissionId: AUDIT_SUBMISSION_ID,
    eventType: 'legal_reference_updated',
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: canonicalActorRole(input.actor),
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'legal_reference',
    relatedEntityId: updated.id,
    fromValue: { status: existing.status, version: existing.version },
    toValue: { status: updated.status, version: updated.version },
    reason,
    internalNote: reason,
    metadata: {
      ...META,
      changedFields,
      beforeAfter: changedFields.reduce<Record<string, { before: unknown; after: unknown }>>((acc, field) => {
        acc[field] = { before: (existing as Record<string, unknown>)[field], after: (updated as Record<string, unknown>)[field] };
        return acc;
      }, {}),
    },
  });
  return updated;
}

async function setStatus(input: { actor: StaffActorContext; legalReferenceId: string; reason: string; toStatus: LegalReferenceStatus; eventType: 'legal_reference_reviewed'|'legal_reference_approved'|'legal_reference_marked_stale'|'legal_reference_archived'; }) {
  requireStaffActorContext(input.actor); const reason=requireReason(input.reason);
  assertPermission(input.actor, input.toStatus==='approved'?PERMISSIONS.APPROVE_LEGAL_REFERENCE:input.toStatus==='reviewed'?PERMISSIONS.REVIEW_LEGAL_REFERENCE:PERMISSIONS.MANAGE_LEGAL_REFERENCE);
  const existing = await db.legalReference.findUniqueOrThrow({ where: { id: input.legalReferenceId } });
  assertStatusTransition(existing.status, input.toStatus);
  const updated = await db.legalReference.update({ where: { id: input.legalReferenceId }, data: { status: input.toStatus, ...(input.toStatus==='reviewed'?{ reviewedAt:new Date(), reviewedByStaffUserId: input.actor.actorStaffUserId }:{}), ...(input.toStatus==='approved'?{ approvedAt:new Date(), approvedByStaffUserId: input.actor.actorStaffUserId }:{}), ...(input.toStatus==='stale'?{ staleAt:new Date() }:{}), ...(input.toStatus==='archived'?{ archivedAt:new Date() }:{}), version: { increment: 1 } } });
  await writeAudit({ legalReferenceId: updated.id, eventType: input.eventType, actor: input.actor, reason, fromValue: existing.status, toValue: updated.status });
  return updated;
}

export const markLegalReferenceReviewed = (input: { actor: StaffActorContext; legalReferenceId: string; reason: string }) => setStatus({ ...input, toStatus: 'reviewed', eventType: 'legal_reference_reviewed' });
export const approveLegalReference = (input: { actor: StaffActorContext; legalReferenceId: string; reason: string }) => setStatus({ ...input, toStatus: 'approved', eventType: 'legal_reference_approved' });
export const markLegalReferenceStale = (input: { actor: StaffActorContext; legalReferenceId: string; reason: string }) => setStatus({ ...input, toStatus: 'stale', eventType: 'legal_reference_marked_stale' });
export const archiveLegalReference = (input: { actor: StaffActorContext; legalReferenceId: string; reason: string }) => setStatus({ ...input, toStatus: 'archived', eventType: 'legal_reference_archived' });

export async function listApprovedLegalReferencesForTopic(topic: LegalReferenceTopic) {
  return db.legalReference.findMany({ where: { topic, status: 'approved' }, orderBy: { updatedAt: 'desc' } });
}
