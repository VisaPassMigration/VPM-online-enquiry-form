import React from 'react';
import Link from 'next/link';

import { PERMISSIONS, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { db } from '@/server/db';
import { addCostReference, addOccupationReference, approveMigrationReferenceDataset, archiveMigrationReferenceDataset, createMigrationReferenceDataset, markMigrationReferenceDatasetReviewed, markMigrationReferenceDatasetStale } from '@/server/migrationReferenceData';

async function requireActor(permission: string) {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(permission as never);
  const actorId = String(session.user.staffUserId ?? '').trim();
  if (!actorId) throw new Error('Missing authenticated staff actor id');
  return { actorId, actorName: session.user.name?.trim() || session.user.email?.trim() || actorId, actorRole: resolveActorRole(session.user.roles ?? []), actorStaffUserId: actorId, actorRoles: (session.user.roles ?? []) as RoleKey[] };
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

export default async function MigrationReferenceDataPage() {
  await requirePermission(PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA);
  const datasets = await db.migrationReferenceDataset.findMany({ include: { occupationReferences: true, costReferences: true }, orderBy: { importedAt: 'desc' } });
  return <section className="section"><h1>Migration Reference Data</h1><p>Migration Reference Data is used to support internal C.L.E.A.R report preparation. It must be reviewed and approved by authorised staff before being relied on for consultation reports.</p><Link href="/admin/audit-log">Audit log</Link>{datasets.map((d)=><article key={d.id}><h3>{d.datasetVersion}</h3><p>Status: {d.status} | Source: {d.sourceSummary ?? '—'} | Imported: {d.importedAt.toISOString()}</p><p>Reviewed: {d.reviewedByStaffUserId ?? '—'} / {d.reviewedAt?.toISOString() ?? '—'} | Approved: {d.approvedByStaffUserId ?? '—'} / {d.approvedAt?.toISOString() ?? '—'} | Stale: {d.staleAt?.toISOString() ?? '—'}</p><p>Notes: {d.notes ?? '—'} | Occupation refs: {d.occupationReferences.length} | Cost refs: {d.costReferences.length}</p></article>)}<form action={runMutationAction}><h3>Create dataset</h3><input name="action" defaultValue="create_dataset" hidden readOnly/><input name="datasetVersion" placeholder="dataset version"/><input name="sourceSummary" placeholder="source summary"/><textarea name="notes"/><textarea name="reason"/><button type="submit">Create dataset</button></form></section>;
}
