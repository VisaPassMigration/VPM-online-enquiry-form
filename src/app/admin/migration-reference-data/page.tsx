import React from 'react';
import Link from 'next/link';

import { auth } from '@/auth';
import { PERMISSIONS, hasPermission, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
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

const statusBadgeClass: Record<string, string> = {
  draft: 'status-chip status-chip-draft',
  reviewed: 'status-chip status-chip-reviewed',
  approved: 'status-chip status-chip-approved',
  stale: 'status-chip status-chip-stale',
  archived: 'status-chip status-chip-archived',
};

export default async function MigrationReferenceDataPage() {
  await requirePermission(PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA);
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as RoleKey[];
  const canManage = hasPermission(roles, PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA);
  const canApprove = hasPermission(roles, PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA);

  const datasets = await db.migrationReferenceDataset.findMany({ include: { occupationReferences: true, costReferences: true }, orderBy: { importedAt: 'desc' } });
  const activeDataset = datasets[0];

  return <section className="section"><h1>Migration Reference Data</h1><p>Only approved reference datasets should be relied on for C.L.E.A.R preparation. Stale or draft datasets require review before consultation use.</p><p><strong>Reference data must be manually reviewed and approved by authorised staff. This page does not scrape, auto-sync, or verify live government data.</strong></p><Link href="/admin/audit-log">Audit log</Link>
    <h2>Dataset Overview</h2>{datasets.map((d)=><article key={d.id} className="card"><h3>{d.datasetVersion} <span className={statusBadgeClass[d.status] ?? 'status-chip'}>{d.status}</span></h3><p>Source: {d.sourceSummary ?? '—'}</p><p>importedAt: {d.importedAt.toISOString()}</p><p>reviewedByStaffUserId / reviewedAt: {d.reviewedByStaffUserId ?? '—'} / {d.reviewedAt?.toISOString() ?? '—'}</p><p>approvedByStaffUserId / approvedAt: {d.approvedByStaffUserId ?? '—'} / {d.approvedAt?.toISOString() ?? '—'}</p><p>staleAt: {d.staleAt?.toISOString() ?? '—'}</p><p>Notes: {d.notes ?? '—'} | Occupation refs: {d.occupationReferences.length} | Cost refs: {d.costReferences.length}</p></article>)}

    {canManage && <><h2>Dataset Lifecycle Actions</h2><p><strong>All mutation forms require an internal reason/note for audit history.</strong></p><form action={runMutationAction}><h3>Create dataset</h3><input name="action" defaultValue="create_dataset" hidden readOnly/><input name="datasetVersion" placeholder="dataset version" required/><input name="sourceSummary" placeholder="source summary"/><textarea name="notes" placeholder="dataset notes"/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Create dataset</button></form>{activeDataset && <><form action={runMutationAction}><h3>Mark reviewed</h3><input name="action" defaultValue="mark_reviewed" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Mark reviewed</button></form>{canApprove && <form action={runMutationAction}><h3>Approve dataset</h3><input name="action" defaultValue="approve" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Approve dataset</button></form>}<form action={runMutationAction}><h3>Mark stale</h3><input name="action" defaultValue="mark_stale" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Mark stale</button></form><form action={runMutationAction}><h3>Archive dataset</h3><input name="action" defaultValue="archive" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Archive dataset</button></form></>}</>}

    {canManage && activeDataset && <><h2>Occupation References</h2><form action={runMutationAction}><h3>Add occupation reference</h3><input name="action" defaultValue="add_occupation" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><input name="occupationCode" placeholder="occupation code" required/><input name="occupationTitle" placeholder="occupation title" required/><input name="classificationSource" placeholder="classification source"/><input name="possibleVisaSubclasses" placeholder="visa subclasses (comma separated)"/><input name="occupationListSource" placeholder="occupation list source"/><input name="assessingAuthority" placeholder="assessing authority"/><input name="shortageIndicator" placeholder="shortage indicator"/><input name="sourceUrl" placeholder="source url"/><input name="sourceDate" type="date"/><textarea name="notes" placeholder="internal notes"/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Add occupation reference</button></form>
      <h2>Cost References</h2><form action={runMutationAction}><h3>Add cost reference</h3><input name="action" defaultValue="add_cost" hidden readOnly/><input name="datasetId" defaultValue={activeDataset.id} readOnly/><input name="category" placeholder="category" required/><input name="label" placeholder="label" required/><input name="amount" placeholder="amount" required/><input name="currency" placeholder="currency" required/><input name="sourceUrl" placeholder="source url"/><input name="sourceDate" type="date"/><textarea name="notes" placeholder="internal notes"/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Add cost reference</button></form></>}

    <h2>Governance Notes</h2><ul><li>Mutation actions remain staff-controlled and audited through service functions.</li><li>No live scraping, no auto-sync, and no verification of live government data occurs on this page.</li><li>No PDF generation, client sharing, or email sending is performed from this admin UI.</li></ul>
  </section>;
}
