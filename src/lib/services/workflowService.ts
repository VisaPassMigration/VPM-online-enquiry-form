import { submissionStatusSchema } from '@/lib/schemas/intakeSubmission';

type SubmissionStatus = ReturnType<typeof submissionStatusSchema.parse>;

type TransitionContext = {
  actorId?: string;
  namedReviewer?: string;
  humanReviewComplete?: boolean;
  humanOutcomeReleaseAllowed?: boolean;
};

const allowedTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: ['submitted'],
  submitted: ['intake_triage_in_progress', 'on_hold', 'closed'],
  intake_triage_in_progress: ['awaiting_client_documents', 'document_review_in_progress', 'on_hold', 'closed'],
  awaiting_client_documents: ['document_review_in_progress', 'on_hold', 'closed'],
  document_review_in_progress: ['risk_review_in_progress', 'awaiting_client_documents', 'on_hold', 'closed'],
  risk_review_in_progress: ['preliminary_points_review_in_progress', 'on_hold', 'closed'],
  preliminary_points_review_in_progress: ['senior_review_in_progress', 'on_hold', 'closed'],
  senior_review_in_progress: ['ready_for_client_summary', 'on_hold', 'closed'],
  ready_for_client_summary: ['client_summary_sent', 'on_hold', 'closed'],
  client_summary_sent: ['on_hold', 'closed'],
  on_hold: ['intake_triage_in_progress', 'awaiting_client_documents', 'document_review_in_progress', 'risk_review_in_progress', 'preliminary_points_review_in_progress', 'senior_review_in_progress', 'ready_for_client_summary', 'closed'],
  closed: [],
};

const internalDecisionTransitions: SubmissionStatus[] = [
  'risk_review_in_progress',
  'preliminary_points_review_in_progress',
  'senior_review_in_progress',
  'ready_for_client_summary',
  'client_summary_sent',
];

export function validateStatusTransition(from: SubmissionStatus, to: SubmissionStatus, context: TransitionContext = {}) {
  const fromStatus = submissionStatusSchema.parse(from);
  const toStatus = submissionStatusSchema.parse(to);

  if (!allowedTransitions[fromStatus].includes(toStatus)) {
    throw new Error(`Unsafe status transition: ${fromStatus} -> ${toStatus}`);
  }

  if (internalDecisionTransitions.includes(toStatus) && !context.namedReviewer?.trim()) {
    throw new Error('A named reviewer is required for internal decision and release actions.');
  }

  if (toStatus === 'client_summary_sent' && !context.humanReviewComplete) {
    throw new Error('No client-facing outcome release is allowed without completed human review.');
  }

  if (toStatus === 'client_summary_sent' && !context.humanOutcomeReleaseAllowed) {
    throw new Error('humanOutcomeReleaseAllowed must be true before client-facing release.');
  }

  return {
    actorId: context.actorId,
    fromStatus,
    toStatus,
    namedReviewer: context.namedReviewer,
    validatedAt: new Date().toISOString(),
  };
}
