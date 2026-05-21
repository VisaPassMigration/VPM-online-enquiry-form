import type { MigrationReferenceDatasetStatus } from '@prisma/client';

import { PERMISSIONS, type RoleKey, hasPermission } from './auth/permissions';
import { recordAuditEvent } from './audit';
import { db } from './db';

type StaffActorContext = {
  actorId: string;
  actorName: string;
  actorRole: RoleKey;
  actorStaffUserId: string;
  actorRoles: RoleKey[];
};

const META = { internalOnly: true, referenceData: true };

function normalize(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireStaffActorContext(actor: StaffActorContext) {
  if (!actor.actorId?.trim() || !actor.actorName?.trim() || !actor.actorRole?.trim() || !actor.actorStaffUserId?.trim()) {
    throw new Error('Authenticated staff actor context is required.');
  }
}

function assertPermission(actor: StaffActorContext, permission: string) {
  if (!hasPermission(actor.actorRoles, permission as never)) throw new Error(`Missing permission: ${permission}.`);
}

function requireReason(reason?: string) {
  const note = normalize(reason);
  if (!note) throw new Error('Internal note/reason is required.');
  return note;
}

async function writeDatasetAudit(input: {
  datasetId: string;
  eventType:
    | 'migration_reference_dataset_imported'
    | 'migration_reference_dataset_reviewed'
    | 'migration_reference_dataset_approved'
    | 'migration_reference_dataset_marked_stale'
    | 'migration_reference_dataset_archived'
    | 'occupation_reference_created'
    | 'cost_reference_created';
  actor: StaffActorContext;
  reason: string;
  fromValue?: string | null;
  toValue?: string | null;
}) {
  await recordAuditEvent({
    submissionId: `migration-reference-dataset:${input.datasetId}`,
    eventType: input.eventType,
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: input.actor.actorRole,
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'migration_reference_dataset',
    relatedEntityId: input.datasetId,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
    internalNote: input.reason,
    reason: input.reason,
    metadata: META,
  });
}

export async function createMigrationReferenceDataset(input: { actor: StaffActorContext; datasetVersion: string; sourceSummary?: string; notes?: string; reason: string; }) {
  requireStaffActorContext(input.actor);
  assertPermission(input.actor, PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA);
  const reason = requireReason(input.reason);
  const created = await db.migrationReferenceDataset.create({ data: { datasetVersion: input.datasetVersion.trim(), sourceSummary: normalize(input.sourceSummary) ?? null, notes: normalize(input.notes) ?? null, status: 'draft' } });
  await writeDatasetAudit({ datasetId: created.id, eventType: 'migration_reference_dataset_imported', actor: input.actor, reason, toValue: created.status });
  return created;
}

async function setStatus(input: { actor: StaffActorContext; datasetId: string; reason: string; toStatus: MigrationReferenceDatasetStatus; eventType: 'migration_reference_dataset_reviewed' | 'migration_reference_dataset_approved' | 'migration_reference_dataset_marked_stale' | 'migration_reference_dataset_archived'; }) {
  requireStaffActorContext(input.actor);
  const reason = requireReason(input.reason);
  const permission = input.toStatus === 'approved' ? PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA : PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA;
  assertPermission(input.actor, permission);
  const existing = await db.migrationReferenceDataset.findUniqueOrThrow({ where: { id: input.datasetId } });
  const updated = await db.migrationReferenceDataset.update({
    where: { id: input.datasetId },
    data: {
      status: input.toStatus,
      ...(input.toStatus === 'reviewed' ? { reviewedAt: new Date(), reviewedByStaffUserId: input.actor.actorStaffUserId } : {}),
      ...(input.toStatus === 'approved' ? { approvedAt: new Date(), approvedByStaffUserId: input.actor.actorStaffUserId } : {}),
      ...(input.toStatus === 'stale' ? { staleAt: new Date() } : {}),
    },
  });
  await writeDatasetAudit({ datasetId: existing.id, eventType: input.eventType, actor: input.actor, reason, fromValue: existing.status, toValue: updated.status });
  return updated;
}

export const markMigrationReferenceDatasetReviewed = (input: { actor: StaffActorContext; datasetId: string; reason: string; }) =>
  setStatus({ ...input, toStatus: 'reviewed', eventType: 'migration_reference_dataset_reviewed' });
export const approveMigrationReferenceDataset = (input: { actor: StaffActorContext; datasetId: string; reason: string; }) =>
  setStatus({ ...input, toStatus: 'approved', eventType: 'migration_reference_dataset_approved' });
export const markMigrationReferenceDatasetStale = (input: { actor: StaffActorContext; datasetId: string; reason: string; }) =>
  setStatus({ ...input, toStatus: 'stale', eventType: 'migration_reference_dataset_marked_stale' });
export const archiveMigrationReferenceDataset = (input: { actor: StaffActorContext; datasetId: string; reason: string; }) =>
  setStatus({ ...input, toStatus: 'archived', eventType: 'migration_reference_dataset_archived' });

export async function addOccupationReference(input: { actor: StaffActorContext; datasetId: string; reason: string; occupationCode: string; occupationTitle: string; classificationSource?: string; possibleVisaSubclasses?: string[]; occupationListSource?: string; assessingAuthority?: string; shortageIndicator?: string; sourceUrl?: string; sourceDate?: string; notes?: string; }) {
  requireStaffActorContext(input.actor);
  assertPermission(input.actor, PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA);
  const reason = requireReason(input.reason);
  const created = await db.occupationReference.create({ data: { datasetId: input.datasetId, occupationCode: input.occupationCode.trim(), occupationTitle: input.occupationTitle.trim(), classificationSource: normalize(input.classificationSource) ?? null, possibleVisaSubclasses: input.possibleVisaSubclasses ?? [], occupationListSource: normalize(input.occupationListSource) ?? null, assessingAuthority: normalize(input.assessingAuthority) ?? null, shortageIndicator: normalize(input.shortageIndicator) ?? null, sourceUrl: normalize(input.sourceUrl) ?? null, sourceDate: input.sourceDate ? new Date(input.sourceDate) : null, notes: normalize(input.notes) ?? null } });
  await writeDatasetAudit({ datasetId: input.datasetId, eventType: 'occupation_reference_created', actor: input.actor, reason, toValue: `occupation_reference:${created.id}` });
  return created;
}

export async function addCostReference(input: { actor: StaffActorContext; datasetId: string; reason: string; category: string; label: string; amount?: string; currency?: string; sourceUrl?: string; sourceDate?: string; notes?: string; }) {
  requireStaffActorContext(input.actor);
  assertPermission(input.actor, PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA);
  const reason = requireReason(input.reason);
  const created = await db.costReference.create({ data: { datasetId: input.datasetId, category: input.category.trim(), label: input.label.trim(), amount: normalize(input.amount) ?? null, currency: normalize(input.currency) ?? null, sourceUrl: normalize(input.sourceUrl) ?? null, sourceDate: input.sourceDate ? new Date(input.sourceDate) : null, notes: normalize(input.notes) ?? null } });
  await writeDatasetAudit({ datasetId: input.datasetId, eventType: 'cost_reference_created', actor: input.actor, reason, toValue: `cost_reference:${created.id}` });
  return created;
}
