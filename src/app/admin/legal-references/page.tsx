import React from 'react';
const LEGAL_REFERENCE_TOPICS = ['section_48_bar', 'character', 'visa_criteria', 'procedural_fairness', 'health', 'family_violence', 'detention', 'review_rights', 'bridging_visa'] as const;
const LEGAL_REFERENCE_TYPES = ['act_section', 'regulation', 'legislative_instrument', 'policy_guidance', 'case_law'] as const;
const LEGAL_REFERENCE_STATUSES = ['draft', 'reviewed', 'approved', 'stale', 'archived'] as const;

import { PERMISSIONS } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { db } from '@/server/db';

type Props = { searchParams?: Promise<{ topic?: string; referenceType?: string; status?: string }> };

export default async function LegalReferencesPage({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.VIEW_LEGAL_REFERENCE);
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

  return <section className="section"><h1>Legal References</h1><p><strong>Legal Reference Library is internal guidance only. It does not auto-generate legal advice and must not be treated as a client-facing legal conclusion.</strong></p>
    <form method="get"><input name="topic" placeholder="filter topic" defaultValue={filters.topic ?? ''}/><input name="referenceType" placeholder="filter referenceType" defaultValue={filters.referenceType ?? ''}/><input name="status" placeholder="filter status" defaultValue={filters.status ?? ''}/><button type="submit">Apply filters</button></form>
    {references.map((r)=><article key={r.id} className="card"><h2>{r.sectionOrSchedule}</h2><p>type/topic/status: {r.referenceType} / {r.topic} / {r.status}</p><p>source: {r.sourceUrl ?? '—'} | sourceDate: {r.sourceDate?.toISOString() ?? '—'} | legendComReference: {r.legendComReference ?? '—'}</p><p>reviewedBy/At: {r.reviewedByStaffUserId ?? '—'} / {r.reviewedAt?.toISOString() ?? '—'}</p><p>approvedBy/At: {r.approvedByStaffUserId ?? '—'} / {r.approvedAt?.toISOString() ?? '—'}</p></article>)}
  </section>;
}
