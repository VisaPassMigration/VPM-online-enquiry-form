import React from 'react';

import { auth } from '@/auth';
import {
  approveLegalReference,
  archiveLegalReference,
  createLegalReference,
  markLegalReferenceReviewed,
  markLegalReferenceStale,
  updateLegalReference,
} from '@/server/legalReferences';
import { PERMISSIONS, hasPermission, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { db } from '@/server/db';

const LEGAL_REFERENCE_TOPICS = ['section_48_bar', 'character', 'visa_criteria', 'procedural_fairness', 'health', 'family_violence', 'detention', 'review_rights', 'bridging_visa'] as const;
const LEGAL_REFERENCE_TYPES = ['act_section', 'regulation', 'legislative_instrument', 'policy_guidance', 'case_law'] as const;
const LEGAL_REFERENCE_STATUSES = ['draft', 'reviewed', 'approved', 'stale', 'archived'] as const;

const statusBadgeClass: Record<string, string> = {
  draft: 'status-chip status-chip-draft',
  reviewed: 'status-chip status-chip-reviewed',
  approved: 'status-chip status-chip-approved',
  stale: 'status-chip status-chip-stale',
  archived: 'status-chip status-chip-archived',
};

type Props = { searchParams?: Promise<{ topic?: string; referenceType?: string; status?: string }> };

async function requireActor(permission: string) {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(permission as never);
  const actorId = String(session.user.staffUserId ?? '').trim();
  if (!actorId) throw new Error('Missing authenticated staff actor id');
  return {
    actorId,
    actorName: session.user.name?.trim() || session.user.email?.trim() || actorId,
    actorRole: resolveActorRole(session.user.roles ?? []),
    actorStaffUserId: actorId,
    actorRoles: (session.user.roles ?? []) as RoleKey[],
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
      referenceType: String(formData.get('referenceType') ?? '') as (typeof LEGAL_REFERENCE_TYPES)[number],
      jurisdiction: String(formData.get('jurisdiction') ?? ''),
      actName: String(formData.get('actName') ?? ''),
      regulationName: String(formData.get('regulationName') ?? ''),
      instrumentName: String(formData.get('instrumentName') ?? ''),
      sectionOrSchedule: String(formData.get('sectionOrSchedule') ?? ''),
      topic: String(formData.get('topic') ?? '') as (typeof LEGAL_REFERENCE_TOPICS)[number],
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
        referenceType: String(formData.get('referenceType') ?? '') as (typeof LEGAL_REFERENCE_TYPES)[number],
        jurisdiction: String(formData.get('jurisdiction') ?? ''),
        actName: String(formData.get('actName') ?? ''),
        regulationName: String(formData.get('regulationName') ?? ''),
        instrumentName: String(formData.get('instrumentName') ?? ''),
        sectionOrSchedule: String(formData.get('sectionOrSchedule') ?? ''),
        topic: String(formData.get('topic') ?? '') as (typeof LEGAL_REFERENCE_TOPICS)[number],
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

export default async function LegalReferencesPage({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.VIEW_LEGAL_REFERENCE);
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as RoleKey[];
  const canManage = hasPermission(roles, PERMISSIONS.MANAGE_LEGAL_REFERENCE);
  const canReview = hasPermission(roles, PERMISSIONS.REVIEW_LEGAL_REFERENCE);
  const canApprove = hasPermission(roles, PERMISSIONS.APPROVE_LEGAL_REFERENCE);

  const filters = (await searchParams) ?? {};
  const topic = LEGAL_REFERENCE_TOPICS.includes(filters.topic as (typeof LEGAL_REFERENCE_TOPICS)[number]) ? filters.topic : undefined;
  const referenceType = LEGAL_REFERENCE_TYPES.includes(filters.referenceType as (typeof LEGAL_REFERENCE_TYPES)[number]) ? filters.referenceType : undefined;
  const status = LEGAL_REFERENCE_STATUSES.includes(filters.status as (typeof LEGAL_REFERENCE_STATUSES)[number]) ? filters.status : undefined;
  const references = await db.legalReference.findMany({
    where: {
      ...(topic ? { topic } : {}),
      ...(referenceType ? { referenceType } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  const activeReference = references[0];

  return <section className="section"><h1>Legal References</h1>
    <h2>Legal Reference Overview</h2><p><strong>Legal references are internal guidance only. They do not generate legal advice and must not be treated as client-facing legal conclusions.</strong></p>
    <p><strong>Do not paste large LEGENDcom or policy extracts. Store short reviewed summaries, source pointers, and operational notes only.</strong></p>
    <form method="get"><input name="topic" placeholder="filter topic" defaultValue={filters.topic ?? ''}/><input name="referenceType" placeholder="filter referenceType" defaultValue={filters.referenceType ?? ''}/><input name="status" placeholder="filter status" defaultValue={filters.status ?? ''}/><button type="submit">Apply filters</button></form>
    {references.map((r)=><article key={r.id} className="card"><h3>{r.sectionOrSchedule} <span className={statusBadgeClass[r.status] ?? 'status-chip'}>{r.status}</span></h3><p>type/topic/status: {r.referenceType} / {r.topic} / {r.status}</p><p>source: {r.sourceUrl ?? '—'} | sourceDate: {r.sourceDate?.toISOString() ?? '—'} | legendComReference: {r.legendComReference ?? '—'}</p><p>reviewedBy/At: {r.reviewedByStaffUserId ?? '—'} / {r.reviewedAt?.toISOString() ?? '—'}</p><p>approvedBy/At: {r.approvedByStaffUserId ?? '—'} / {r.approvedAt?.toISOString() ?? '—'}</p></article>)}

    {canManage && <><h2>Create Legal Reference</h2><form action={runMutationAction}><input name="action" defaultValue="create_legal_reference" hidden readOnly/>
      <input name="referenceType" placeholder="referenceType" required/><input name="jurisdiction" placeholder="jurisdiction" required/><input name="actName" placeholder="actName"/><input name="regulationName" placeholder="regulationName"/><input name="instrumentName" placeholder="instrumentName"/><input name="sectionOrSchedule" placeholder="sectionOrSchedule" required/><input name="topic" placeholder="topic" required/>
      <textarea name="summary" placeholder="summary" required/><textarea name="operationalNotes" placeholder="operationalNotes"/><textarea name="riskTriggerNotes" placeholder="riskTriggerNotes"/><input name="sourceUrl" placeholder="sourceUrl"/><input name="legendComReference" placeholder="legendComReference"/><input name="sourceDate" type="date"/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Create legal reference</button></form>

      <h2>Update Legal Reference</h2>{activeReference && <form action={runMutationAction}><input name="action" defaultValue="update_legal_reference" hidden readOnly/><input name="legalReferenceId" defaultValue={activeReference.id} readOnly/>
        <input name="referenceType" defaultValue={activeReference.referenceType} placeholder="referenceType" required/><input name="jurisdiction" defaultValue={activeReference.jurisdiction} placeholder="jurisdiction" required/><input name="actName" defaultValue={activeReference.actName ?? ''} placeholder="actName"/><input name="regulationName" defaultValue={activeReference.regulationName ?? ''} placeholder="regulationName"/><input name="instrumentName" defaultValue={activeReference.instrumentName ?? ''} placeholder="instrumentName"/><input name="sectionOrSchedule" defaultValue={activeReference.sectionOrSchedule} placeholder="sectionOrSchedule" required/><input name="topic" defaultValue={activeReference.topic} placeholder="topic" required/>
        <textarea name="summary" defaultValue={activeReference.summary} placeholder="summary" required/><textarea name="operationalNotes" defaultValue={activeReference.operationalNotes ?? ''} placeholder="operationalNotes"/><textarea name="riskTriggerNotes" defaultValue={activeReference.riskTriggerNotes ?? ''} placeholder="riskTriggerNotes"/><input name="sourceUrl" defaultValue={activeReference.sourceUrl ?? ''} placeholder="sourceUrl"/><input name="legendComReference" defaultValue={activeReference.legendComReference ?? ''} placeholder="legendComReference"/><input name="sourceDate" defaultValue={activeReference.sourceDate?.toISOString().slice(0,10) ?? ''} type="date"/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Update legal reference</button></form>}</>}

    {(canManage || canReview || canApprove) && activeReference && <><h2>Lifecycle Actions</h2>{canReview && <form action={runMutationAction}><input name="action" defaultValue="mark_reviewed" hidden readOnly/><input name="legalReferenceId" defaultValue={activeReference.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Mark reviewed</button></form>}{canApprove && <form action={runMutationAction}><input name="action" defaultValue="approve" hidden readOnly/><input name="legalReferenceId" defaultValue={activeReference.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Approve</button></form>}{canManage && <><form action={runMutationAction}><input name="action" defaultValue="mark_stale" hidden readOnly/><input name="legalReferenceId" defaultValue={activeReference.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Mark stale</button></form><form action={runMutationAction}><input name="action" defaultValue="archive" hidden readOnly/><input name="legalReferenceId" defaultValue={activeReference.id} readOnly/><textarea name="reason" placeholder="Required internal reason/note" required/><button type="submit">Archive</button></form></>}</>}

    <h2>Governance Notes</h2><ul><li>Legal references remain staff-controlled, source-linked, reviewed, approved, and audited.</li><li>No LEGENDcom scraping, no live policy fetching, and no legal advice generation is performed on this admin page.</li><li>No client-facing sharing, intake mutation behaviour changes, or C.L.E.A.R email/PDF workflow changes are introduced here.</li></ul>
  </section>;
}
