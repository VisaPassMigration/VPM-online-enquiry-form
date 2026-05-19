import { LeadRating, Prisma } from '@prisma/client';

import { recordAuditEvent } from './audit';
import { db } from './db';
import { PERMISSIONS, type RoleKey, hasPermission } from './auth/permissions';

type ActorContext = {
  actorId: string;
  actorName: string;
  actorRole: RoleKey;
  actorStaffUserId: string;
  actorRoles: RoleKey[];
};

type SuggestLeadRatingInput = {
  submissionId: string;
  actor: ActorContext;
  reason?: string;
};

type ConfirmLeadRatingInput = {
  submissionId: string;
  actor: ActorContext;
  rating: LeadRating;
  reason: string;
};

type ChangeLeadRatingInput = {
  submissionId: string;
  actor: ActorContext;
  rating: LeadRating;
  reason: string;
};

function assertPermission(actorRoles: RoleKey[], permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]): void {
  if (!hasPermission(actorRoles, permission)) throw new Error(`Missing permission: ${permission}.`);
}

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function computeSuggestedLeadRating(params: {
  unresolvedSevereRiskCount: number;
  preliminaryPoints?: number;
  missingEvidenceCount: number;
  englishKnown: boolean;
  claritySignals: number;
}): { rating: LeadRating; reason: string } {
  if (params.unresolvedSevereRiskCount > 0) {
    return { rating: 'escalate', reason: 'Severe unresolved risk detected; requires escalation triage.' };
  }

  const points = params.preliminaryPoints ?? 0;
  const evidencePenalty = params.missingEvidenceCount >= 3 ? 2 : params.missingEvidenceCount > 0 ? 1 : 0;
  const englishPenalty = params.englishKnown ? 0 : 1;
  const clarityPenalty = params.claritySignals >= 2 ? 0 : 1;
  const totalPenalty = evidencePenalty + englishPenalty + clarityPenalty;

  if (points >= 80 && totalPenalty === 0) {
    return { rating: 'hot', reason: 'Strong preliminary points with low risk and complete evidence profile.' };
  }

  if (points >= 65 && totalPenalty <= 2) {
    return { rating: 'warm', reason: 'Viable preliminary profile with manageable gaps for staff follow-up.' };
  }

  return { rating: 'cold', reason: 'Lower confidence profile due to evidence gaps, unclear criteria, or limited points.' };
}

function buildMetadata() {
  return { internalOnly: true, triageClassification: true } as Prisma.InputJsonObject;
}

export async function suggestLeadRating(input: SuggestLeadRatingInput) {
  assertPermission(input.actor.actorRoles, PERMISSIONS.SUGGEST_LEAD_RATING);

  const submission = await db.intakeSubmission.findUniqueOrThrow({
    where: { id: input.submissionId },
    include: {
      riskFlags: true,
      pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      documents: true,
    },
  });

  const unresolvedSevereRiskCount = submission.riskFlags.filter(
    (flag) => flag.resolutionStatus !== 'resolved' && (flag.severity === 'high' || flag.severity === 'critical'),
  ).length;
  const latestPoints = submission.pointsSnapshots[0]?.totalPoints;
  const missingEvidenceCount = submission.documents.filter(
    (doc) => doc.verificationStatus === 'not_uploaded' || doc.verificationStatus === 'needs_reupload' || doc.verificationStatus === 'rejected',
  ).length;

  const payload = (submission.payload ?? {}) as Record<string, unknown>;
  const englishKnown = Boolean(payload.englishTestType || payload.englishScore || payload.englishLevel);
  const claritySignals = [payload.occupation, payload.workExperienceYears, payload.highestQualification].filter(Boolean).length;

  const suggested = computeSuggestedLeadRating({
    unresolvedSevereRiskCount,
    preliminaryPoints: latestPoints,
    missingEvidenceCount,
    englishKnown,
    claritySignals,
  });

  const updated = await db.intakeSubmission.update({
    where: { id: input.submissionId },
    data: {
      leadRatingSuggested: suggested.rating,
      leadRatingSuggestedAt: new Date(),
      leadRatingReason: normalize(input.reason) ?? suggested.reason,
    },
  });

  await recordAuditEvent({
    submissionId: input.submissionId,
    eventType: 'lead_rating_suggested',
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: input.actor.actorRole,
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'intake_submission',
    relatedEntityId: input.submissionId,
    fromValue: submission.leadRatingSuggested,
    toValue: suggested.rating,
    internalNote: normalize(input.reason) ?? suggested.reason,
    metadata: buildMetadata(),
  });

  return updated;
}

export async function confirmLeadRating(input: ConfirmLeadRatingInput) {
  assertPermission(input.actor.actorRoles, PERMISSIONS.CONFIRM_LEAD_RATING);
  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });

  const updated = await db.intakeSubmission.update({
    where: { id: input.submissionId },
    data: {
      leadRating: input.rating,
      leadRatingReason: input.reason.trim(),
      leadRatingConfirmedBy: input.actor.actorName,
      leadRatingConfirmedAt: new Date(),
    },
  });

  await recordAuditEvent({
    submissionId: input.submissionId,
    eventType: 'lead_rating_confirmed',
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: input.actor.actorRole,
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'intake_submission',
    relatedEntityId: input.submissionId,
    fromValue: submission.leadRating,
    toValue: input.rating,
    internalNote: input.reason.trim(),
    metadata: buildMetadata(),
  });

  return updated;
}

export async function changeLeadRating(input: ChangeLeadRatingInput) {
  assertPermission(input.actor.actorRoles, PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING);
  if (!input.reason.trim()) throw new Error('Reason is required when changing confirmed lead rating.');

  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });

  const updated = await db.intakeSubmission.update({
    where: { id: input.submissionId },
    data: {
      leadRating: input.rating,
      leadRatingReason: input.reason.trim(),
      leadRatingConfirmedBy: input.actor.actorName,
      leadRatingConfirmedAt: new Date(),
    },
  });

  await recordAuditEvent({
    submissionId: input.submissionId,
    eventType: 'lead_rating_changed',
    actorId: input.actor.actorId,
    actorName: input.actor.actorName,
    actorRole: input.actor.actorRole,
    actorStaffUserId: input.actor.actorStaffUserId,
    relatedEntityType: 'intake_submission',
    relatedEntityId: input.submissionId,
    fromValue: submission.leadRating,
    toValue: input.rating,
    internalNote: input.reason.trim(),
    metadata: buildMetadata(),
  });

  return updated;
}
