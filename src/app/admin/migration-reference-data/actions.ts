import { PERMISSIONS, normalizeRoleKeys } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { addCostReference, addOccupationReference, approveMigrationReferenceDataset, archiveMigrationReferenceDataset, createMigrationReferenceDataset, markMigrationReferenceDatasetReviewed, markMigrationReferenceDatasetStale } from '@/server/migrationReferenceData';

async function requireActor(permission: string) {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(permission as never);
  const actorId = String(session.user.staffUserId ?? '').trim();
  if (!actorId) throw new Error('Missing authenticated staff actor id');
  const actorRoles = normalizeRoleKeys(session.user.roles ?? []);
  const actorRole = actorRoles[0];
  if (!actorRole) throw new Error('Missing authenticated staff actor role');
  return { actorId, actorName: session.user.name?.trim() || session.user.email?.trim() || actorId, actorRole, actorStaffUserId: actorId, actorRoles };
}

export async function runMutationAction(formData: FormData) {
  'use server';
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (action === 'create_dataset') {
    const actor = await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA);
    await createMigrationReferenceDataset({ actor, reason, datasetVersion: String(formData.get('datasetVersion') ?? ''), sourceSummary: String(formData.get('sourceSummary') ?? ''), notes: String(formData.get('notes') ?? '') });
  }
  const datasetId = String(formData.get('datasetId') ?? '');
  if (!datasetId) return;
  if (action === 'mark_reviewed') await markMigrationReferenceDatasetReviewed({ actor: await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA), datasetId, reason });
  if (action === 'approve') await approveMigrationReferenceDataset({ actor: await requireActor(PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA), datasetId, reason });
  if (action === 'mark_stale') await markMigrationReferenceDatasetStale({ actor: await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA), datasetId, reason });
  if (action === 'archive') await archiveMigrationReferenceDataset({ actor: await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA), datasetId, reason });
  if (action === 'add_occupation') await addOccupationReference({ actor: await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA), datasetId, reason, occupationCode: String(formData.get('occupationCode') ?? ''), occupationTitle: String(formData.get('occupationTitle') ?? ''), classificationSource: String(formData.get('classificationSource') ?? ''), possibleVisaSubclasses: String(formData.get('possibleVisaSubclasses') ?? '').split(',').map((v) => v.trim()).filter(Boolean), occupationListSource: String(formData.get('occupationListSource') ?? ''), assessingAuthority: String(formData.get('assessingAuthority') ?? ''), shortageIndicator: String(formData.get('shortageIndicator') ?? ''), sourceUrl: String(formData.get('sourceUrl') ?? ''), sourceDate: String(formData.get('sourceDate') ?? ''), notes: String(formData.get('notes') ?? '') });
  if (action === 'add_cost') await addCostReference({ actor: await requireActor(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA), datasetId, reason, category: String(formData.get('category') ?? ''), label: String(formData.get('label') ?? ''), amount: String(formData.get('amount') ?? ''), currency: String(formData.get('currency') ?? ''), sourceUrl: String(formData.get('sourceUrl') ?? ''), sourceDate: String(formData.get('sourceDate') ?? ''), notes: String(formData.get('notes') ?? '') });
}
