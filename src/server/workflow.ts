/**
 * Internal backend-only workflow/state transition service.
 * API routes will invoke this later.
 * Human review is mandatory before any client-facing outcome status.
 */

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'intake_triage_in_progress'
  | 'awaiting_client_documents'
  | 'document_review_in_progress'
  | 'risk_review_in_progress'
  | 'preliminary_points_review_in_progress'
  | 'senior_review_in_progress'
  | 'ready_for_client_summary'
  | 'client_summary_sent'
  | 'on_hold'
  | 'closed';

const ALLOWED_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
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

const CLIENT_FACING_OUTCOMES: SubmissionStatus[] = ['client_summary_sent'];

export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function validateWorkflowTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
  context: {
    humanReviewComplete?: boolean;
    humanOutcomeReleaseAllowed?: boolean;
    reviewerId?: string;
    isAutomatedAction?: boolean;
  } = {},
) {
  if (!canTransition(from, to)) {
    throw new Error(`Unsafe transition: ${from} -> ${to}`);
  }

  if (CLIENT_FACING_OUTCOMES.includes(to)) {
    if (!context.humanReviewComplete) throw new Error('Client-facing outcome requires completed human review.');
    if (!context.humanOutcomeReleaseAllowed) throw new Error('Client-facing outcome requires explicit human release approval.');
    if (!context.reviewerId?.trim()) throw new Error('Named reviewer is required before client-facing outcome release.');
    if (context.isAutomatedAction) throw new Error('Automatic client-facing outcome release is not allowed.');
  }

  return { from, to, validatedAt: new Date().toISOString() };
}
